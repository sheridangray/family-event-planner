/**
 * String similarity utilities for event deduplication
 */

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} str1 
 * @param {string} str2 
 * @returns {number} Edit distance
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  // Initialize matrix
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  // Fill matrix
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Calculate similarity score between two strings (0-1, where 1 is identical)
 * @param {string} str1 
 * @param {string} str2 
 * @returns {number} Similarity score
 */
function levenshteinSimilarity(str1, str2) {
  if (str1 === str2) return 1.0;
  if (!str1 || !str2) return 0.0;
  
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1.0;
  
  const distance = levenshteinDistance(str1, str2);
  return 1 - (distance / maxLength);
}

/**
 * Calculate Jaccard similarity based on word sets
 * @param {string} str1 
 * @param {string} str2 
 * @returns {number} Jaccard similarity score
 */
function jaccardSimilarity(str1, str2) {
  const words1 = new Set(str1.toLowerCase().split(/\s+/));
  const words2 = new Set(str2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return union.size === 0 ? 0 : intersection.size / union.size;
}

/**
 * Calculate composite similarity score using multiple algorithms
 * @param {string} str1 
 * @param {string} str2 
 * @returns {number} Composite similarity score
 */
function compositeSimilarity(str1, str2) {
  const levenshtein = levenshteinSimilarity(str1, str2);
  const jaccard = jaccardSimilarity(str1, str2);
  
  // Weight Levenshtein more heavily for exact matches, Jaccard for word overlap
  return (levenshtein * 0.7) + (jaccard * 0.3);
}

/**
 * Normalize string for comparison
 * @param {string} str 
 * @returns {string} Normalized string
 */
function normalizeString(str) {
  if (!str) return '';
  
  return str.toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\b(the|a|an|and|or|at|in|on|for|with|by)\b/g, '') // Remove common words
    .replace(/\s+/g, ' ')    // Normalize whitespace (do this after word removal)
    .trim();
}

module.exports = {
  levenshteinDistance,
  levenshteinSimilarity,
  jaccardSimilarity,
  compositeSimilarity,
  normalizeString
};