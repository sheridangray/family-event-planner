const express = require('express');
const { authenticateAPI } = require('../middleware/auth');
const { Pool } = require('pg');

const router = express.Router();

// Initialize database connection
const getDbPool = () => {
  const connectionString = process.env.DATABASE_URL || 'postgresql://localhost:5432/family_event_planner';
  return new Pool({
    connectionString,
    ssl: connectionString.includes('render.com') ? { rejectUnauthorized: false } : false
  });
};

// GET /api/family/settings - Get all family settings
router.get('/settings', authenticateAPI, async (req, res) => {
  const pool = getDbPool();
  try {
    const result = await pool.query(`
      SELECT setting_key, setting_value, setting_type, description, updated_at
      FROM family_settings
      ORDER BY setting_key
    `);

    // Transform to key-value object with typed values
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
            // Keep as string if JSON parsing fails
          }
          break;
        // 'string' remains as-is
      }

      settings[row.setting_key] = {
        value,
        type: row.setting_type,
        description: row.description,
        updated_at: row.updated_at
      };
    });

    res.json({
      success: true,
      settings,
      count: result.rows.length
    });

  } catch (error) {
    req.app.locals.logger?.error('Family settings fetch error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch family settings'
    });
  } finally {
    await pool.end();
  }
});

// PUT /api/family/settings - Update family settings
router.put('/settings', authenticateAPI, async (req, res) => {
  const pool = getDbPool();
  try {
    const updates = req.body.settings;
    
    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Settings object required in request body'
      });
    }

    await pool.query('BEGIN');

    const updatedSettings = [];
    
    for (const [key, valueData] of Object.entries(updates)) {
      let value = valueData.value !== undefined ? valueData.value : valueData;
      let type = valueData.type || 'string';
      
      // Convert value to string for storage
      if (type === 'json') {
        value = JSON.stringify(value);
      } else {
        value = String(value);
      }

      const result = await pool.query(`
        UPDATE family_settings 
        SET setting_value = $1, setting_type = $2, updated_at = NOW()
        WHERE setting_key = $3
        RETURNING setting_key, setting_value, setting_type, updated_at
      `, [value, type, key]);

      if (result.rows.length > 0) {
        updatedSettings.push(result.rows[0]);
      }
    }

    await pool.query('COMMIT');

    res.json({
      success: true,
      message: `Updated ${updatedSettings.length} settings`,
      updated: updatedSettings
    });

  } catch (error) {
    await pool.query('ROLLBACK');
    req.app.locals.logger?.error('Family settings update error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to update family settings'
    });
  } finally {
    await pool.end();
  }
});

// GET /api/family/children - Get all children profiles
router.get('/children', authenticateAPI, async (req, res) => {
  const pool = getDbPool();
  try {
    const result = await pool.query(`
      SELECT id, name, birth_date, interests, special_needs, active, created_at, updated_at
      FROM children
      WHERE active = true
      ORDER BY birth_date ASC
    `);

    // Calculate ages and format data
    const children = result.rows.map(child => {
      const birthDate = new Date(child.birth_date);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      return {
        id: child.id,
        name: child.name,
        birthDate: child.birth_date,
        age,
        interests: child.interests || [],
        specialNeeds: child.special_needs || '',
        active: child.active,
        createdAt: child.created_at,
        updatedAt: child.updated_at
      };
    });

    res.json({
      success: true,
      children,
      count: children.length
    });

  } catch (error) {
    req.app.locals.logger?.error('Children profiles fetch error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch children profiles'
    });
  } finally {
    await pool.end();
  }
});

// POST /api/family/children - Create new child profile
router.post('/children', authenticateAPI, async (req, res) => {
  const pool = getDbPool();
  try {
    const { name, birthDate, interests, specialNeeds } = req.body;

    if (!name || !birthDate) {
      return res.status(400).json({
        success: false,
        error: 'Name and birth date are required'
      });
    }

    const result = await pool.query(`
      INSERT INTO children (name, birth_date, interests, special_needs)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, birth_date, interests, special_needs, active, created_at, updated_at
    `, [
      name,
      birthDate,
      interests || [],
      specialNeeds || ''
    ]);

    const child = result.rows[0];
    
    // Calculate age for response
    const age = Math.floor((Date.now() - new Date(child.birth_date)) / (365.25 * 24 * 60 * 60 * 1000));

    res.status(201).json({
      success: true,
      message: 'Child profile created successfully',
      child: {
        id: child.id,
        name: child.name,
        birthDate: child.birth_date,
        age,
        interests: child.interests || [],
        specialNeeds: child.special_needs || '',
        active: child.active,
        createdAt: child.created_at,
        updatedAt: child.updated_at
      }
    });

  } catch (error) {
    req.app.locals.logger?.error('Child profile creation error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to create child profile'
    });
  } finally {
    await pool.end();
  }
});

// PUT /api/family/children/:id - Update child profile
router.put('/children/:id', authenticateAPI, async (req, res) => {
  const pool = getDbPool();
  try {
    const { id } = req.params;
    const { name, birthDate, interests, specialNeeds, active } = req.body;

    const result = await pool.query(`
      UPDATE children 
      SET name = COALESCE($1, name),
          birth_date = COALESCE($2, birth_date),
          interests = COALESCE($3, interests),
          special_needs = COALESCE($4, special_needs),
          active = COALESCE($5, active),
          updated_at = NOW()
      WHERE id = $6
      RETURNING id, name, birth_date, interests, special_needs, active, created_at, updated_at
    `, [name, birthDate, interests, specialNeeds, active, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Child profile not found'
      });
    }

    const child = result.rows[0];
    const age = Math.floor((Date.now() - new Date(child.birth_date)) / (365.25 * 24 * 60 * 60 * 1000));

    res.json({
      success: true,
      message: 'Child profile updated successfully',
      child: {
        id: child.id,
        name: child.name,
        birthDate: child.birth_date,
        age,
        interests: child.interests || [],
        specialNeeds: child.special_needs || '',
        active: child.active,
        createdAt: child.created_at,
        updatedAt: child.updated_at
      }
    });

  } catch (error) {
    req.app.locals.logger?.error('Child profile update error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to update child profile'
    });
  } finally {
    await pool.end();
  }
});

// DELETE /api/family/children/:id - Soft delete child profile
router.delete('/children/:id', authenticateAPI, async (req, res) => {
  const pool = getDbPool();
  try {
    const { id } = req.params;

    const result = await pool.query(`
      UPDATE children 
      SET active = false, updated_at = NOW()
      WHERE id = $1
      RETURNING id, name
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Child profile not found'
      });
    }

    res.json({
      success: true,
      message: `Child profile for ${result.rows[0].name} deactivated successfully`
    });

  } catch (error) {
    req.app.locals.logger?.error('Child profile deletion error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to delete child profile'
    });
  } finally {
    await pool.end();
  }
});

// GET /api/family/contacts - Get all family contacts
router.get('/contacts', authenticateAPI, async (req, res) => {
  const pool = getDbPool();
  try {
    const result = await pool.query(`
      SELECT fc.id, fc.contact_type, fc.name, fc.email, fc.phone, fc.is_primary,
             fc.created_at, fc.updated_at, u.id as user_id, u.role as user_role
      FROM family_contacts fc
      LEFT JOIN users u ON fc.user_id = u.id
      ORDER BY fc.contact_type, fc.is_primary DESC, fc.name
    `);

    const contacts = result.rows.map(contact => ({
      id: contact.id,
      contactType: contact.contact_type,
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      isPrimary: contact.is_primary,
      userId: contact.user_id,
      userRole: contact.user_role,
      createdAt: contact.created_at,
      updatedAt: contact.updated_at
    }));

    res.json({
      success: true,
      contacts,
      count: contacts.length
    });

  } catch (error) {
    req.app.locals.logger?.error('Family contacts fetch error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch family contacts'
    });
  } finally {
    await pool.end();
  }
});

// Helper function to get a specific setting value
const getSetting = async (key, defaultValue = null) => {
  const pool = getDbPool();
  try {
    const result = await pool.query(
      'SELECT setting_value, setting_type FROM family_settings WHERE setting_key = $1',
      [key]
    );

    if (result.rows.length === 0) {
      return defaultValue;
    }

    const { setting_value, setting_type } = result.rows[0];

    // Convert based on type
    switch (setting_type) {
      case 'number':
        return parseFloat(setting_value);
      case 'boolean':
        return setting_value.toLowerCase() === 'true';
      case 'json':
        try {
          return JSON.parse(setting_value);
        } catch (e) {
          return setting_value;
        }
      default:
        return setting_value;
    }
  } catch (error) {
    console.error(`Error getting setting ${key}:`, error.message);
    return defaultValue;
  } finally {
    await pool.end();
  }
};

// GET /api/family/user-by-email - Get user ID by email
router.get('/user-by-email', async (req, res) => {
  const pool = getDbPool();
  try {
    const { email } = req.query;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email parameter required'
      });
    }

    const result = await pool.query(
      'SELECT id, email, name, role, active FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    res.json({
      success: true,
      user: result.rows[0]
    });

  } catch (error) {
    req.app.locals.logger?.error('User lookup error:', error.message);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user'
    });
  } finally {
    await pool.end();
  }
});

// Export the router and helper functions
module.exports = {
  router,
  getSetting
};