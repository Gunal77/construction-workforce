const bcrypt = require('bcrypt');
const pool = require('../config/db');
const { signToken } = require('../utils/jwt');

/**
 * Unified Login for ALL user types (admin, client, supervisor, staff)
 * Uses the users table with role-based access control
 * Enforces role-based access: admin -> admin portal, staff -> mobile app
 */
const unifiedLogin = async (req, res) => {
  try {
    const { email, password, source } = req.body; // source: 'admin-portal' or 'mobile-app'

    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Email and password are required' 
      });
    }

    const normalizedEmail = email.toString().trim().toLowerCase();

    // Query unified users table with profile status
    const query = `
      SELECT 
        u.id,
        u.email,
        u.password_hash,
        u.role,
        u.user_type,
        u.name,
        u.phone,
        u.is_active,
        u.profile_id,
        CASE 
          WHEN u.role = 'admin' THEN a.status
          WHEN u.role = 'staff' THEN e.status
          ELSE 'active'
        END as profile_status
      FROM users u
      LEFT JOIN admins a ON a.user_id = u.id
      LEFT JOIN employees e ON e.user_id = u.id
      WHERE LOWER(u.email) = $1
    `;

    const result = await pool.query(query, [normalizedEmail]);

    if (result.rows.length === 0) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
    }

    const user = result.rows[0];

    // Check if user is active in users table
    if (!user.is_active) {
      return res.status(403).json({ 
        success: false,
        message: 'Account is inactive. Please contact administrator.' 
      });
    }

    // Check profile status (for admin and staff)
    if (user.profile_status === 'inactive') {
      return res.status(403).json({ 
        success: false,
        message: 'Account is inactive. Please contact administrator.' 
      });
    }

    // Enforce role-based access control
    if (user.role === 'admin' && source === 'mobile-app') {
      return res.status(403).json({ 
        success: false,
        message: 'Admin accounts can only access the Admin Portal. Please use the web application.' 
      });
    }

    if (user.role === 'staff' && source === 'admin-portal') {
      return res.status(403).json({ 
        success: false,
        message: 'Staff accounts can only access the Mobile App. Please use the mobile application.' 
      });
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
    }

    // Generate JWT token with role
    const token = signToken({
      id: user.id,
      email: user.email,
      role: user.role,
      userType: user.user_type
    });

    // Prepare user response (exclude password_hash)
    const userResponse = {
      id: user.id,
      email: user.email,
      role: user.role,
      userType: user.user_type,
      name: user.name,
      phone: user.phone,
      profileId: user.profile_id
    };

    return res.json({
      success: true,
      token,
      message: 'Login successful',
      user: userResponse
    });

  } catch (error) {
    console.error('Unified login error:', error);
    return res.status(500).json({ 
      success: false,
      message: 'An error occurred during login' 
    });
  }
};

/**
 * Create a new user with specific role
 * Admin only function
 */
const createUser = async (req, res) => {
  try {
    const { email, password, role, name, phone, userType } = req.body;
    const createdBy = req.user?.id || req.admin?.id;

    // Validation
    if (!email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Email, password, and role are required'
      });
    }

    // Validate role
    const validRoles = ['admin', 'client', 'supervisor', 'staff'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
      });
    }

    const normalizedEmail = email.toString().trim().toLowerCase();

    // Check if user already exists
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE LOWER(email) = $1',
      [normalizedEmail]
    );

    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insert into users table
    const query = `
      INSERT INTO users (email, password_hash, role, user_type, name, phone, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, TRUE)
      RETURNING id, email, role, user_type, name, phone, created_at
    `;

    const result = await pool.query(query, [
      normalizedEmail,
      passwordHash,
      role,
      userType || role,
      name,
      phone
    ]);

    const newUser = result.rows[0];

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        id: newUser.id,
        email: newUser.email,
        role: newUser.role,
        userType: newUser.user_type,
        name: newUser.name,
        phone: newUser.phone,
        createdAt: newUser.created_at
      }
    });

  } catch (error) {
    console.error('Create user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create user'
    });
  }
};

/**
 * Get current user profile
 */
const getCurrentUser = async (req, res) => {
  try {
    const userId = req.user?.id || req.admin?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    const query = `
      SELECT 
        u.id,
        u.email,
        u.role,
        u.user_type,
        u.name,
        u.phone,
        u.is_active,
        u.created_at
      FROM users u
      WHERE u.id = $1
    `;

    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('Get current user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch user'
    });
  }
};

module.exports = {
  unifiedLogin,
  createUser,
  getCurrentUser
};

