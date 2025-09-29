/**
 * Family Configuration Service
 * 
 * Provides database-first configuration loading with environment variable fallbacks.
 * Manages family settings, preferences, and demographics from the database.
 */

class FamilyConfigService {
  constructor(database, logger = null) {
    this.database = database;
    this.logger = logger;
    this.settingsCache = null;
    this.cacheExpiry = null;
    this.cacheTtlMs = 5 * 60 * 1000; // 5 minutes cache
  }

  /**
   * Get all family settings with type conversion and caching
   */
  async getSettings() {
    // Check cache first
    if (this.settingsCache && this.cacheExpiry && Date.now() < this.cacheExpiry) {
      return this.settingsCache;
    }

    try {
      const result = await this.database.query(`
        SELECT setting_key, setting_value, setting_type, description
        FROM family_settings
        ORDER BY setting_key
      `);

      const settings = {};
      result.rows.forEach(row => {
        let value = row.setting_value;

        // Convert based on type
        switch (row.setting_type) {
          case 'number':
            value = parseFloat(value);
            break;
          case 'boolean':
            value = value.toLowerCase() === 'true';
            break;
          case 'json':
            try {
              value = JSON.parse(value);
            } catch (e) {
              if (this.logger) {
                this.logger.warn(`Failed to parse JSON setting ${row.setting_key}: ${e.message}`);
              }
              // Keep as string if JSON parsing fails
            }
            break;
          // 'string' remains as-is
        }

        settings[row.setting_key] = value;
      });

      // Cache the results
      this.settingsCache = settings;
      this.cacheExpiry = Date.now() + this.cacheTtlMs;

      if (this.logger) {
        this.logger.debug(`Loaded ${Object.keys(settings).length} family settings from database`);
      }

      return settings;

    } catch (error) {
      if (this.logger) {
        this.logger.error('Error loading family settings from database:', error.message);
        this.logger.info('Falling back to environment variables for settings');
      }

      // Return default settings when database fails
      return this.getDefaultSettings();
    }
  }

  /**
   * Get specific setting with fallback to environment variable
   */
  async getSetting(key, defaultValue = null, envVarName = null) {
    try {
      const settings = await this.getSettings();
      
      if (settings[key] !== undefined) {
        return settings[key];
      }

      return defaultValue;

    } catch (error) {
      if (this.logger) {
        this.logger.warn(`Error getting setting ${key}:`, error.message);
      }
      
      return defaultValue;
    }
  }

  /**
   * Get family configuration object compatible with existing config structure
   */
  async getFamilyConfig() {
    const settings = await this.getSettings();

    return {
      gmail: {
        parent1Email: process.env.PARENT1_EMAIL,
        parent2Email: process.env.PARENT2_EMAIL,
        mcpCredentials: process.env.MCP_GMAIL_CREDENTIALS_JSON ? 
          JSON.parse(process.env.MCP_GMAIL_CREDENTIALS_JSON) : null,
      },
      
      twilio: {
        phoneTo: process.env.TWILIO_PHONE_TO,
        mcpCredentials: process.env.MCP_TWILIO_CREDENTIALS,
      },
      
      location: {
        homeAddress: settings.home_address || 'San Francisco',
        homeZip: settings.home_zip || '94158',
        homeCity: settings.home_city || 'San Francisco',
        homeState: settings.home_state || 'CA',
        homeCountry: settings.home_country || 'US',
        maxDistanceMiles: settings.max_distance_miles || 30,
      },
      
      schedule: {
        weekdayEarliestTime: settings.weekday_earliest_time || '16:30',
        weekendEarliestTime: settings.weekend_earliest_time || '08:00',
        weekendNapStart: settings.weekend_nap_start || '12:00',
        weekendNapEnd: settings.weekend_nap_end || '14:00',
      },
      
      preferences: {
        minChildAge: settings.min_child_age || 2,
        maxChildAge: settings.max_child_age || 4,
        maxCostPerEvent: settings.max_cost_per_event || 200,
        minAdvanceDays: settings.min_advance_days || 2,
        maxAdvanceMonths: settings.max_advance_months || 6,
      },
      
      family: {
        // Family information now comes from database (children, family_contacts tables)
        parent1Name: 'Unknown',
        parent2Name: 'Unknown',  
        child1Name: 'Unknown',
        child1Age: 4,
        child2Name: 'Unknown',
        child2Age: 2,
        emergencyContact: 'Unknown',
      },
      
      app: {
        port: parseInt(process.env.PORT) || 3000,
        nodeEnv: process.env.NODE_ENV || 'development',
        logLevel: process.env.LOG_LEVEL || 'info',
      },
      
      discovery: {
        eventsPerWeekMin: settings.events_per_week_min || 8,
        eventsPerWeekMax: settings.events_per_week_max || 20,
        eventsPerDayMax: settings.events_per_day_max || 3,
        scanFrequencyHours: settings.scan_frequency_hours || 6,
        urgentScanFrequencyHours: settings.urgent_scan_frequency_hours || 1,
      },
    };
  }

  /**
   * Get family demographics from database
   */
  async getFamilyDemographics() {
    try {
      // Get children from database
      const childrenResult = await this.database.query(`
        SELECT name, birth_date, interests, special_needs
        FROM children
        WHERE active = true
        ORDER BY birth_date ASC
      `);

      // Get parents from family_contacts
      const parentsResult = await this.database.query(`
        SELECT name, email, phone
        FROM family_contacts
        WHERE contact_type = 'parent'
        ORDER BY is_primary DESC
      `);

      // Get emergency contacts
      const emergencyResult = await this.database.query(`
        SELECT name, email, phone
        FROM family_contacts
        WHERE contact_type = 'emergency'
      `);

      // Calculate demographics
      const children = childrenResult.rows.map(child => {
        const birthDate = new Date(child.birth_date);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }

        return {
          name: child.name,
          birthDate: child.birth_date,
          currentAge: age,
          interests: child.interests || [],
          specialNeeds: child.special_needs || ''
        };
      });

      const parents = parentsResult.rows.map(parent => ({
        name: parent.name,
        email: parent.email,
        phone: parent.phone
      }));

      const emergencyContacts = emergencyResult.rows.map(contact => ({
        name: contact.name,
        email: contact.email,
        phone: contact.phone
      }));

      const demographics = {
        parents,
        children,
        childAges: children.map(child => child.currentAge),
        emergencyContacts,
        minChildAge: children.length > 0 ? Math.min(...children.map(c => c.currentAge)) : 0,
        maxChildAge: children.length > 0 ? Math.max(...children.map(c => c.currentAge)) : 18
      };

      if (this.logger) {
        this.logger.debug('Family demographics loaded from database:', {
          parents: demographics.parents.length,
          children: demographics.children.length,
          ageRange: `${demographics.minChildAge}-${demographics.maxChildAge}`
        });
      }

      return demographics;

    } catch (error) {
      if (this.logger) {
        this.logger.error('Error loading family demographics from database:', error.message);
        this.logger.error('Family demographics unavailable - using minimal defaults');
      }

      // Return minimal defaults when database fails
      return this.getDefaultFamilyDemographics();
    }
  }

  /**
   * Invalidate settings cache
   */
  invalidateCache() {
    this.settingsCache = null;
    this.cacheExpiry = null;
    if (this.logger) {
      this.logger.debug('Family settings cache invalidated');
    }
  }

  /**
   * Update a setting in the database and invalidate cache
   */
  async updateSetting(key, value, type = 'string') {
    try {
      // Convert value to string for storage
      let storedValue = value;
      if (type === 'json') {
        storedValue = JSON.stringify(value);
      } else {
        storedValue = String(value);
      }

      await this.database.query(`
        UPDATE family_settings 
        SET setting_value = $1, setting_type = $2, updated_at = NOW()
        WHERE setting_key = $3
      `, [storedValue, type, key]);

      // Invalidate cache to force reload
      this.invalidateCache();

      if (this.logger) {
        this.logger.info(`Updated family setting: ${key} = ${value}`);
      }

      return true;

    } catch (error) {
      if (this.logger) {
        this.logger.error(`Error updating setting ${key}:`, error.message);
      }
      throw error;
    }
  }

  /**
   * Get default settings values when database is unavailable
   */
  getDefaultSettings() {
    if (this.logger) {
      this.logger.warn('Database unavailable, using default settings');
    }

    return {
      home_address: 'San Francisco',
      home_zip: '94158',
      home_city: 'San Francisco',
      home_state: 'CA',
      home_country: 'US',
      max_distance_miles: 30,
      weekday_earliest_time: '16:30',
      weekend_earliest_time: '08:00',
      weekend_nap_start: '12:00',
      weekend_nap_end: '14:00',
      min_child_age: 2,
      max_child_age: 4,
      max_cost_per_event: 200,
      min_advance_days: 2,
      max_advance_months: 6,
      events_per_week_min: 8,
      events_per_week_max: 20,
      events_per_day_max: 3,
      scan_frequency_hours: 6,
      urgent_scan_frequency_hours: 1
    };
  }

  /**
   * Get default family demographics when database is unavailable
   */
  getDefaultFamilyDemographics() {
    if (this.logger) {
      this.logger.error('Database unavailable for family demographics - using minimal defaults');
    }

    return {
      parents: [],
      children: [],
      childAges: [],
      emergencyContacts: [],
      minChildAge: 2,
      maxChildAge: 4
    };
  }

  /**
   * Convert environment variable string to appropriate type
   */
  convertEnvValue(value) {
    // Try to convert to number
    if (!isNaN(value) && !isNaN(parseFloat(value))) {
      return parseFloat(value);
    }

    // Try to convert to boolean
    if (value.toLowerCase() === 'true') return true;
    if (value.toLowerCase() === 'false') return false;

    // Return as string
    return value;
  }
}

module.exports = FamilyConfigService;