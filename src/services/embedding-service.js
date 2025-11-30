/**
 * Embedding Service
 * Generates embeddings for text using Together AI or OpenAI
 */

const axios = require('axios');

class EmbeddingService {
  constructor(logger) {
    this.logger = logger;
    this.apiKey = process.env.TOGETHER_AI_API_KEY;
    this.baseUrl = 'https://api.together.xyz/v1/embeddings';
    
    if (!this.apiKey) {
      this.logger.warn('TOGETHER_AI_API_KEY not set - embedding generation will fail');
    }
  }

  /**
   * Generate embedding for text
   * @param {string} text - Text to embed
   * @returns {Promise<Array<number>>} Embedding vector
   */
  async generateEmbedding(text) {
    try {
      if (!this.apiKey) {
        throw new Error('TOGETHER_AI_API_KEY not configured');
      }

      if (!text || text.trim().length === 0) {
        throw new Error('Text cannot be empty');
      }

      // Together AI embeddings endpoint
      const response = await axios.post(
        this.baseUrl,
        {
          model: 'togethercomputer/m2-bert-80M-8k-retrieval', // Good embedding model
          input: text.trim(),
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000, // 10 second timeout
        }
      );

      if (!response.data || !response.data.data || !response.data.data[0]) {
        throw new Error('Invalid response from embedding API');
      }

      const embedding = response.data.data[0].embedding;
      
      // Ensure we have a valid embedding array
      if (!Array.isArray(embedding) || embedding.length === 0) {
        throw new Error('Invalid embedding format');
      }

      this.logger.debug(`Generated embedding of dimension ${embedding.length} for text: ${text.substring(0, 50)}...`);
      
      return embedding;
    } catch (error) {
      this.logger.error('Error generating embedding:', error.message);
      throw error;
    }
  }

  /**
   * Generate embeddings for multiple texts
   * @param {Array<string>} texts - Array of texts to embed
   * @returns {Promise<Array<Array<number>>>} Array of embedding vectors
   */
  async generateEmbeddings(texts) {
    try {
      if (!this.apiKey) {
        throw new Error('TOGETHER_AI_API_KEY not configured');
      }

      if (!Array.isArray(texts) || texts.length === 0) {
        throw new Error('Texts must be a non-empty array');
      }

      // Together AI supports batch embeddings
      const response = await axios.post(
        this.baseUrl,
        {
          model: 'togethercomputer/m2-bert-80M-8k-retrieval',
          input: texts.map(t => t.trim()),
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000, // 30 second timeout for batch
        }
      );

      if (!response.data || !response.data.data) {
        throw new Error('Invalid response from embedding API');
      }

      const embeddings = response.data.data.map(item => item.embedding);
      
      this.logger.debug(`Generated ${embeddings.length} embeddings`);
      
      return embeddings;
    } catch (error) {
      this.logger.error('Error generating batch embeddings:', error.message);
      throw error;
    }
  }
}

module.exports = EmbeddingService;

