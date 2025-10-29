/**
 * Family Email Service
 * 
 * Centralized service for getting parent email addresses from the database.
 * Replaces the need for PARENT1_EMAIL and PARENT2_EMAIL environment variables.
 */

class FamilyEmailService {
  constructor(database, logger = null) {
    this.database = database;
    this.logger = logger;
    this._emailCache = null;
    this._cacheExpiry = null;
    this.CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  }

  /**
   * Get parent email addresses from database
   * @param {boolean} useCache - Whether to use cached results (default: true)
   * @returns {Promise<Object>} Object with parent1Email, parent2Email, and allParents array
   */
  async getParentEmails(useCache = true) {
    try {
      // Check cache first
      if (useCache && this._emailCache && this._cacheExpiry && Date.now() < this._cacheExpiry) {
        if (this.logger) {
          this.logger.debug('Using cached parent emails');
        }
        return this._emailCache;
      }

      // Query database for parent emails
      const parents = await this.database.getFamilyMembersByRole('parent', true);
      
      if (!parents || parents.length === 0) {
        if (this.logger) {
          this.logger.warn('No parent emails found in database');
        }
        return {
          parent1Email: null,
          parent2Email: null,
          allParents: []
        };
      }

      // Sort parents by ID to ensure consistent ordering
      const sortedParents = parents.sort((a, b) => a.id - b.id);
      
      const result = {
        parent1Email: sortedParents[0]?.email || null,
        parent2Email: sortedParents[1]?.email || null,
        allParents: sortedParents.map(parent => ({
          id: parent.id,
          name: parent.name,
          email: parent.email,
          phone: parent.phone
        }))
      };

      // Cache the result
      this._emailCache = result;
      this._cacheExpiry = Date.now() + this.CACHE_DURATION;

      if (this.logger) {
        this.logger.debug(`Loaded parent emails: parent1=${result.parent1Email}, parent2=${result.parent2Email}`);
      }

      return result;

    } catch (error) {
      if (this.logger) {
        this.logger.error('Error loading parent emails from database:', error);
      }
      
      // Return fallback structure
      return {
        parent1Email: null,
        parent2Email: null,
        allParents: []
      };
    }
  }

  /**
   * Get primary parent email (first parent in database)
   * @param {boolean} useCache - Whether to use cached results
   * @returns {Promise<string|null>} Primary parent email or null
   */
  async getPrimaryParentEmail(useCache = true) {
    const emails = await this.getParentEmails(useCache);
    return emails.parent1Email;
  }

  /**
   * Get all parent emails as an array
   * @param {boolean} useCache - Whether to use cached results
   * @returns {Promise<string[]>} Array of parent email addresses
   */
  async getAllParentEmails(useCache = true) {
    const emails = await this.getParentEmails(useCache);
    return emails.allParents.map(parent => parent.email).filter(Boolean);
  }

  /**
   * Check if an email belongs to a family member
   * @param {string} email - Email to check
   * @param {boolean} useCache - Whether to use cached results
   * @returns {Promise<boolean>} True if email belongs to a family member
   */
  async isFamilyMemberEmail(email, useCache = true) {
    if (!email) return false;
    
    const emails = await this.getParentEmails(useCache);
    const allEmails = emails.allParents.map(parent => parent.email).filter(Boolean);
    
    return allEmails.includes(email.toLowerCase().trim());
  }

  /**
   * Get parent by email address
   * @param {string} email - Email to search for
   * @param {boolean} useCache - Whether to use cached results
   * @returns {Promise<Object|null>} Parent object or null if not found
   */
  async getParentByEmail(email, useCache = true) {
    if (!email) return null;
    
    const emails = await this.getParentEmails(useCache);
    return emails.allParents.find(parent => 
      parent.email && parent.email.toLowerCase().trim() === email.toLowerCase().trim()
    ) || null;
  }

  /**
   * Clear the email cache (useful for testing or when data changes)
   */
  clearCache() {
    this._emailCache = null;
    this._cacheExpiry = null;
    if (this.logger) {
      this.logger.debug('Parent email cache cleared');
    }
  }

  /**
   * Get fallback emails from environment variables (for migration period)
   * @returns {Object} Fallback email configuration
   */
  getFallbackEmails() {
    return {
      parent1Email: process.env.PARENT1_EMAIL || null,
      parent2Email: process.env.PARENT2_EMAIL || null,
      allParents: [
        ...(process.env.PARENT1_EMAIL ? [{ email: process.env.PARENT1_EMAIL, name: 'Parent 1' }] : []),
        ...(process.env.PARENT2_EMAIL ? [{ email: process.env.PARENT2_EMAIL, name: 'Parent 2' }] : [])
      ]
    };
  }

  /**
   * Get emails with fallback to environment variables
   * @param {boolean} useCache - Whether to use cached results
   * @returns {Promise<Object>} Email configuration with fallback support
   */
  async getParentEmailsWithFallback(useCache = true) {
    try {
      const dbEmails = await this.getParentEmails(useCache);
      
      // If we have emails from database, use them
      if (dbEmails.parent1Email || dbEmails.parent2Email) {
        return dbEmails;
      }
      
      // Otherwise, fall back to environment variables
      if (this.logger) {
        this.logger.warn('No parent emails found in database, falling back to environment variables');
      }
      
      return this.getFallbackEmails();
      
    } catch (error) {
      if (this.logger) {
        this.logger.error('Error loading parent emails, using fallback:', error);
      }
      
      return this.getFallbackEmails();
    }
  }
}

module.exports = FamilyEmailService;
