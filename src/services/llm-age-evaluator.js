const axios = require('axios');

class LLMAgeEvaluator {
  constructor(logger) {
    this.logger = logger;
    this.apiKey = process.env.TOGETHER_AI_API_KEY;
    this.baseUrl = 'https://api.together.xyz/v1/chat/completions';
    
    if (!this.apiKey) {
      throw new Error('TOGETHER_AI_API_KEY environment variable is required');
    }
  }

  async evaluateEventForChildren(event, childAges) {
    try {
      this.logger.debug(`Evaluating event "${event.title}" for children ages ${childAges.join(', ')}`);
      
      const prompt = this.buildEvaluationPrompt(event, childAges);
      
      const response = await axios.post(this.baseUrl, {
        model: 'meta-llama/Llama-3.2-3B-Instruct-Turbo', // Fast, reliable model
        messages: [
          {
            role: 'system',
            content: 'You are an expert in child development and family activities. You evaluate whether events are suitable and engaging for children of specific ages.'
          },
          {
            role: 'user', 
            content: prompt
          }
        ],
        max_tokens: 200,
        temperature: 0.1, // Low temperature for consistent evaluation
        stop: ['</evaluation>']
      }, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      });

      const completion = response.data.choices[0].message.content;
      return this.parseEvaluation(completion, event, childAges);
      
    } catch (error) {
      // Log detailed error information
      const errorDetails = {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data ? JSON.stringify(error.response.data).substring(0, 500) : 'No response data',
        code: error.code,
        stack: error.stack?.split('\n').slice(0, 3).join('\n') // First 3 lines of stack
      };
      
      this.logger.error(`LLM age evaluation failed for ${event.title}:`, errorDetails);
      
      // Fallback to permissive default if LLM fails
      return {
        suitable: true,
        confidence: 0.5,
        reason: 'LLM evaluation failed, defaulting to permissive',
        fallback: true
      };
    }
  }

  buildEvaluationPrompt(event, childAges) {
    const childAgeList = childAges.join(' and ');
    
    return `Evaluate if this event is suitable for children aged ${childAgeList}:

**Event Details:**
- Title: ${event.title}
- Description: ${event.description || 'No description provided'}
- Listed Age Range: ${event.ageRange ? `${event.ageRange.min}-${event.ageRange.max}` : 'Not specified'}
- Cost: $${event.cost || 0}
- Location: ${event.location?.address || 'Not specified'}
- Source: ${event.source}

**Evaluation Criteria:**
Consider safety, developmental appropriateness, engagement level, and whether the children would genuinely enjoy and benefit from this activity.

**Children's Ages:** ${childAgeList} years old

Please respond in this exact format:
SUITABLE: [YES/NO]
CONFIDENCE: [0.0-1.0]
REASON: [Brief explanation focusing on age appropriateness]

Example responses:
- For a toddler storytime: "SUITABLE: YES, CONFIDENCE: 0.9, REASON: Perfect for developing language skills and attention span at ages 2-4"
- For a teen coding workshop: "SUITABLE: NO, CONFIDENCE: 0.95, REASON: Requires abstract thinking and fine motor skills beyond 2-4 year old capabilities"`;
  }

  parseEvaluation(completion, event, childAges) {
    try {
      this.logger.debug(`LLM response for ${event.title}: ${completion}`);
      
      // Extract structured response
      const suitableMatch = completion.match(/SUITABLE:\s*(YES|NO)/i);
      const confidenceMatch = completion.match(/CONFIDENCE:\s*([\d.]+)/i);
      const reasonMatch = completion.match(/REASON:\s*(.+?)(?:\n|$)/i);
      
      const suitable = suitableMatch ? suitableMatch[1].toUpperCase() === 'YES' : true;
      const confidence = confidenceMatch ? parseFloat(confidenceMatch[1]) : 0.5;
      const reason = reasonMatch ? reasonMatch[1].trim() : 'No specific reason provided';
      
      const result = {
        suitable,
        confidence: Math.min(Math.max(confidence, 0), 1), // Clamp 0-1
        reason,
        childAges: childAges.slice(),
        fallback: false,
        rawResponse: completion.substring(0, 200) // First 200 chars for debugging
      };
      
      this.logger.info(`LLM evaluation for "${event.title}": ${suitable ? '✅ SUITABLE' : '❌ NOT SUITABLE'} (confidence: ${result.confidence})`);
      
      return result;
      
    } catch (error) {
      this.logger.warn(`Error parsing LLM evaluation for ${event.title}:`, error.message);
      
      // Fallback parsing attempt
      const suitable = completion.toLowerCase().includes('suitable: yes') || 
                      completion.toLowerCase().includes('appropriate') ||
                      !completion.toLowerCase().includes('not suitable');
                      
      return {
        suitable,
        confidence: 0.3,
        reason: 'Parsing failed, used keyword detection',
        fallback: true,
        rawResponse: completion.substring(0, 200)
      };
    }
  }

  async batchEvaluateEvents(events, childAges, maxConcurrent = 3) {
    this.logger.info(`Batch evaluating ${events.length} events for children ages ${childAges.join(', ')}`);
    
    const results = new Map();
    const batches = [];
    
    // Create batches to avoid overwhelming the API
    for (let i = 0; i < events.length; i += maxConcurrent) {
      batches.push(events.slice(i, i + maxConcurrent));
    }
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      this.logger.debug(`Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} events)`);
      
      const promises = batch.map(async (event) => {
        const evaluation = await this.evaluateEventForChildren(event, childAges);
        return { event, evaluation };
      });
      
      try {
        const batchResults = await Promise.all(promises);
        batchResults.forEach(({ event, evaluation }) => {
          results.set(event.id, evaluation);
        });
        
        // Small delay between batches to be API-friendly
        if (batchIndex < batches.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
      } catch (error) {
        this.logger.error(`Batch ${batchIndex + 1} failed:`, error.message);
      }
    }
    
    const suitableCount = Array.from(results.values()).filter(r => r.suitable).length;
    this.logger.info(`LLM batch evaluation complete: ${suitableCount}/${events.length} events deemed suitable`);
    
    return results;
  }

  // Cache evaluation results to avoid re-evaluating the same events
  getCacheKey(eventId, childAges) {
    return `llm_eval_${eventId}_${childAges.sort().join('_')}`;
  }
}

module.exports = LLMAgeEvaluator;