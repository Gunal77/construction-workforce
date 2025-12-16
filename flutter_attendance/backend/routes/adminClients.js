const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const bcrypt = require('bcrypt');
const { requireAdmin } = require('../middleware/unifiedAuthMiddleware');

// All routes require admin authentication
router.use(requireAdmin);

// GET all clients
router.get('/', async (req, res) => {
  try {
    const { search, isActive, sortBy = 'created_at', sortOrder = 'DESC' } = req.query;
    
    let query = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        COALESCE(u.is_active, TRUE) as is_active,
        u.created_at,
        0 as project_count,
        0 as supervisor_count,
        0 as staff_count
      FROM users u
      WHERE u.role = 'client'
    `;
    
    const values = [];
    let paramCount = 1;
    
    if (search) {
      query += ` AND (u.name ILIKE $${paramCount} OR u.email ILIKE $${paramCount} OR u.phone ILIKE $${paramCount})`;
      values.push(`%${search}%`);
      paramCount++;
    }
    
    // Validate sortBy to prevent SQL injection
    const allowedSortColumns = ['name', 'email', 'created_at', 'updated_at'];
    const safeSort = allowedSortColumns.includes(sortBy) ? sortBy : 'created_at';
    const safeOrder = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    
    query += ` ORDER BY u.${safeSort} ${safeOrder}`;
    
    const result = await pool.query(query, values);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error('Error fetching clients:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch clients',
      message: error.message
    });
  }
});

// GET client by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        u.id,
        u.name,
        u.email,
        u.phone,
        u.role,
        COALESCE(u.is_active, TRUE) as is_active,
        u.created_at
      FROM users u
      WHERE u.id = $1 AND u.role = 'client'
    `;
    
    const result = await pool.query(query, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }
    
    // For now, return empty arrays for related data
    const projects = { rows: [] };
    const supervisors = { rows: [] };
    const staff = { rows: [] };
    
    res.json({
      success: true,
      data: {
        ...result.rows[0],
        projects: projects.rows,
        supervisors: supervisors.rows,
        staff: staff.rows
      }
    });
  } catch (error) {
    console.error('Error fetching client:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch client',
      message: error.message
    });
  }
});

// POST create new client
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    
    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Name, email, and password are required'
      });
    }
    
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    
    // Check if email already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE LOWER(email) = $1',
      [normalizedEmail]
    );
    
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Email already exists'
      });
    }
    
    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    // Insert into users table with role='client' and is_active=TRUE
    const query = `
      INSERT INTO users (email, password_hash, role, name, phone, is_active, created_at)
      VALUES ($1, $2, 'client', $3, $4, TRUE, NOW())
      RETURNING id, email, name, phone, role, is_active, created_at
    `;
    
    const result = await pool.query(query, [normalizedEmail, passwordHash, name, phone]);
    
    res.status(201).json({
      success: true,
      message: 'Client created successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating client:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create client',
      message: error.message
    });
  }
});

// PUT update client
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, password, is_active } = req.body;
    
    // Check if user exists and is a client
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND role = $2',
      [id, 'client']
    );
    
    if (existingUser.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }
    
    // Build update query for users table
    const userUpdates = [];
    const userValues = [];
    let paramCount = 1;
    
    if (name !== undefined) {
      userUpdates.push(`name = $${paramCount}`);
      userValues.push(name);
      paramCount++;
    }
    
    if (email !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          error: 'Invalid email format'
        });
      }
      
      const normalizedEmail = email.trim().toLowerCase();
      
      // Check if email exists for another user
      const emailCheck = await client.query(
        'SELECT id FROM users WHERE LOWER(email) = $1 AND id != $2',
        [normalizedEmail, id]
      );
      
      if (emailCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({
          success: false,
          error: 'Email already exists'
        });
      }
      
      userUpdates.push(`email = $${paramCount}`);
      userValues.push(normalizedEmail);
      paramCount++;
    }
    
    if (phone !== undefined) {
      userUpdates.push(`phone = $${paramCount}`);
      userValues.push(phone);
      paramCount++;
    }
    
    if (password !== undefined && password.trim() !== '') {
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(password, saltRounds);
      userUpdates.push(`password_hash = $${paramCount}`);
      userValues.push(passwordHash);
      paramCount++;
    }
    
    if (is_active !== undefined) {
      userUpdates.push(`is_active = $${paramCount}`);
      userValues.push(is_active);
      paramCount++;
    }
    
    // Update users table
    if (userUpdates.length > 0) {
      userUpdates.push(`updated_at = NOW()`);
      userValues.push(id);
      
      const userQuery = `
        UPDATE users
        SET ${userUpdates.join(', ')}
        WHERE id = $${paramCount}
        RETURNING id, email, name, phone, is_active, created_at, updated_at
      `;
      
      await client.query(userQuery, userValues);
    }
    
    // Update clients profile table
    const clientUpdates = [];
    const clientValues = [];
    let clientParamCount = 1;
    
    if (companyName !== undefined) {
      clientUpdates.push(`company_name = $${clientParamCount}`);
      clientValues.push(companyName);
      clientParamCount++;
    }
    
    if (contactPerson !== undefined) {
      clientUpdates.push(`contact_person = $${clientParamCount}`);
      clientValues.push(contactPerson);
      clientParamCount++;
    }
    
    if (address !== undefined) {
      clientUpdates.push(`address = $${clientParamCount}`);
      clientValues.push(address);
      clientParamCount++;
    }
    
    if (clientUpdates.length > 0) {
      clientUpdates.push(`updated_by = $${clientParamCount}`);
      clientValues.push(adminId);
      clientParamCount++;
      
      clientUpdates.push(`updated_at = NOW()`);
      
      clientValues.push(id);
      
      const clientQuery = `
        UPDATE clients
        SET ${clientUpdates.join(', ')}
        WHERE user_id = $${clientParamCount}
      `;
      
      await client.query(clientQuery, clientValues);
    }
    
    // Get updated client data
    const result = await client.query(`
      SELECT 
        u.id, u.email, u.name, u.phone, u.is_active, u.created_at, u.updated_at,
        c.company_name, c.contact_person, c.address
      FROM users u
      LEFT JOIN clients c ON c.user_id = u.id
      WHERE u.id = $1
    `, [id]);
    
    await client.query('COMMIT');
    
    res.json({
      success: true,
      message: 'Client updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating client:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update client',
      message: error.message
    });
  } finally {
    client.release();
  }
});

// DELETE client
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user exists and is a client
    const existingUser = await pool.query(
      'SELECT id, name FROM users WHERE id = $1 AND role = \'client\'',
      [id]
    );
    
    if (existingUser.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }
    
    // Check for associated records
    const checksQuery = `
      SELECT 
        (SELECT COUNT(*) FROM projects WHERE client_user_id = $1) as project_count,
        (SELECT COUNT(*) FROM supervisors WHERE client_user_id = $1) as supervisor_count,
        (SELECT COUNT(*) FROM employees WHERE client_user_id = $1) as staff_count
    `;
    
    const checks = await pool.query(checksQuery, [id]);
    const counts = checks.rows[0];
    
    if (counts.project_count > 0 || counts.supervisor_count > 0 || counts.staff_count > 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete client with associated records',
        details: {
          projects: parseInt(counts.project_count),
          supervisors: parseInt(counts.supervisor_count),
          staff: parseInt(counts.staff_count)
        },
        message: 'Please remove or reassign all associated projects, supervisors, and staff before deleting this client.'
      });
    }
    
    // Delete user (will cascade delete client profile)
    await pool.query('DELETE FROM users WHERE id = $1', [id]);
    
    res.json({
      success: true,
      message: 'Client deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting client:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete client',
      message: error.message
    });
  }
});

// GET client statistics
router.get('/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if user exists and is a client
    const clientCheck = await pool.query(
      'SELECT id FROM users WHERE id = $1 AND role = $2',
      [id, 'client']
    );
    
    if (clientCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Client not found'
      });
    }
    
    // Return empty stats for now
    const statsQuery = `
      SELECT 
        0 as total_projects,
        0 as active_projects,
        0 as total_supervisors,
        0 as total_staff,
        0 as assigned_staff
    `;
    
    const result = await pool.query(statsQuery, [id]);
    
    res.json({
      success: true,
      data: {
        projects: {
          total: parseInt(result.rows[0].total_projects),
          active: parseInt(result.rows[0].active_projects)
        },
        supervisors: parseInt(result.rows[0].total_supervisors),
        staff: {
          total: parseInt(result.rows[0].total_staff),
          assigned: parseInt(result.rows[0].assigned_staff),
          unassigned: parseInt(result.rows[0].total_staff) - parseInt(result.rows[0].assigned_staff)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching client stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch client statistics',
      message: error.message
    });
  }
});

module.exports = router;

