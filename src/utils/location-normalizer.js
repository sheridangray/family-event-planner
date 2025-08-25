/**
 * Location normalization utilities for event deduplication
 */

/**
 * Common street type abbreviations and their variations
 */
const STREET_ABBREVIATIONS = {
  'street': ['st', 'str'],
  'avenue': ['ave', 'av'],
  'road': ['rd'],
  'boulevard': ['blvd', 'blv'],
  'drive': ['dr'],
  'lane': ['ln'],
  'place': ['pl'],
  'court': ['ct'],
  'circle': ['cir'],
  'way': ['wy'],
  'parkway': ['pkwy', 'pky'],
  'highway': ['hwy', 'hw']
};

/**
 * Common location aliases in San Francisco
 */
const SF_LOCATION_ALIASES = {
  'golden gate park': ['gg park', 'golden gate', 'ggp'],
  'yerba buena gardens': ['ybg', 'yerba buena', 'yb gardens'],
  'pier 39': ['pier39', 'fishermans wharf', 'fisherman\'s wharf'],
  'union square': ['union sq'],
  'moscone center': ['moscone', 'moscone convention center'],
  'california academy of sciences': ['cal academy', 'calacademy', 'cas'],
  'exploratorium': ['exploratorium at pier 15', 'pier 15'],
  'presidio': ['the presidio'],
  'crissy field': ['crissy fields'],
  'aquarium of the bay': ['aquarium bay', 'pier 39 aquarium'],
  'san francisco zoo': ['sf zoo', 'zoo'],
  'japanese tea garden': ['tea garden'],
  'conservatory of flowers': ['conservatory'],
  'de young museum': ['deyoung', 'de young'],
  'legion of honor': ['california palace legion honor']
};

/**
 * Normalize address for comparison
 * @param {string} address 
 * @returns {string} Normalized address
 */
function normalizeAddress(address) {
  if (!address) return '';
  
  let normalized = address.toLowerCase().trim();
  
  // Remove common punctuation and extra spaces
  normalized = normalized.replace(/[.,;!?()]/g, ' ');
  normalized = normalized.replace(/\s+/g, ' ');
  
  // Normalize street types
  for (const [full, abbrevs] of Object.entries(STREET_ABBREVIATIONS)) {
    const pattern = new RegExp(`\\b(${[full, ...abbrevs].join('|')})\\b`, 'g');
    normalized = normalized.replace(pattern, full);
  }
  
  // Normalize San Francisco references
  normalized = normalized.replace(/\b(san francisco|sf|san fran)\b/g, 'sf');
  normalized = normalized.replace(/\b(california|ca)\b/g, 'ca');
  
  // Handle numbered streets and avenues
  normalized = normalized.replace(/\b(\d+)(st|nd|rd|th)\s+(street|avenue)\b/g, '$1 $3');
  
  // Remove ZIP codes
  normalized = normalized.replace(/\b\d{5}(-\d{4})?\b/g, '');
  
  // Remove "San Francisco, CA" and similar
  normalized = normalized.replace(/,?\s*sf\s*,?\s*ca\s*$/g, '');
  normalized = normalized.replace(/,?\s*california\s*$/g, '');
  
  return normalized.trim();
}

/**
 * Find canonical location name from aliases
 * @param {string} location 
 * @returns {string} Canonical location name
 */
function getCanonicalLocation(location) {
  const normalized = normalizeAddress(location);
  
  for (const [canonical, aliases] of Object.entries(SF_LOCATION_ALIASES)) {
    if (normalized.includes(canonical)) {
      return canonical;
    }
    
    for (const alias of aliases) {
      if (normalized.includes(alias)) {
        return canonical;
      }
    }
  }
  
  return normalized;
}

/**
 * Calculate location similarity between two addresses
 * @param {Object} location1 - Event location object
 * @param {Object} location2 - Event location object
 * @returns {number} Similarity score (0-1)
 */
function compareLocations(location1, location2) {
  if (!location1 || !location2) return 0;
  
  const addr1 = location1.address || '';
  const addr2 = location2.address || '';
  
  if (!addr1 || !addr2) return 0;
  
  // Exact match after normalization
  const norm1 = normalizeAddress(addr1);
  const norm2 = normalizeAddress(addr2);
  
  if (norm1 === norm2) return 1.0;
  
  // Canonical location match
  const canonical1 = getCanonicalLocation(addr1);
  const canonical2 = getCanonicalLocation(addr2);
  
  if (canonical1 === canonical2) return 0.95;
  
  // Check if one address contains the other
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    return 0.8;
  }
  
  // Check for partial matches of significant parts
  const words1 = norm1.split(/\s+/).filter(w => w.length > 2);
  const words2 = norm2.split(/\s+/).filter(w => w.length > 2);
  
  const commonWords = words1.filter(w => words2.includes(w));
  const totalWords = Math.max(words1.length, words2.length);
  
  if (totalWords === 0) return 0;
  
  const wordSimilarity = commonWords.length / totalWords;
  
  // Boost score if key location identifiers match
  const hasCommonStreetNumber = /\b\d+\b/.test(norm1) && /\b\d+\b/.test(norm2) &&
    norm1.match(/\b\d+\b/)?.[0] === norm2.match(/\b\d+\b/)?.[0];
  
  if (hasCommonStreetNumber && wordSimilarity > 0.3) {
    return Math.min(0.9, wordSimilarity + 0.3);
  }
  
  return wordSimilarity;
}

/**
 * Extract key location identifiers (street numbers, venue names)
 * @param {string} address 
 * @returns {Object} Location identifiers
 */
function extractLocationIdentifiers(address) {
  const normalized = normalizeAddress(address);
  
  return {
    streetNumber: normalized.match(/\b\d+\b/)?.[0] || null,
    streetName: normalized.replace(/\b\d+\b/, '').trim(),
    canonical: getCanonicalLocation(address),
    normalized: normalized
  };
}

module.exports = {
  normalizeAddress,
  getCanonicalLocation,
  compareLocations,
  extractLocationIdentifiers,
  SF_LOCATION_ALIASES,
  STREET_ABBREVIATIONS
};