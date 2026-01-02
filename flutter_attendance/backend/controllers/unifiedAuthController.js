const bcrypt = require('bcrypt');
const { signToken } = require('../utils/jwt');
const User = require('../models/User');
const EmployeeMerged = require('../models/EmployeeMerged');
const { v4: uuidv4 } = require('uuid');

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

    // MongoDB: Find user by email
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ 
        success: false,
        message: 'Account is inactive. Please contact administrator.' 
      });
    }

    // Check employee status for WORKER role
    if (user.role === 'WORKER') {
      const employee = await EmployeeMerged.findOne({ user_id: user._id.toString() }).lean();
      if (employee && employee.status === 'inactive') {
        return res.status(403).json({ 
          success: false,
          message: 'Account is inactive. Please contact administrator.' 
        });
      }
    }

    // Enforce role-based access control
    const userRole = user.role.toUpperCase();
    if (userRole === 'ADMIN' && source === 'mobile-app') {
      return res.status(403).json({ 
        success: false,
        message: 'Admin accounts can only access the Admin Portal. Please use the web application.' 
      });
    }

    if (userRole === 'WORKER' && source === 'admin-portal') {
      return res.status(403).json({ 
        success: false,
        message: 'Staff accounts can only access the Mobile App. Please use the mobile application.' 
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid credentials' 
      });
    }

    // Generate JWT token with role
    // Ensure userId and id are strings for consistent token payload
    const userIdString = user._id.toString();
    const token = signToken({
      userId: userIdString,
      id: userIdString,
      email: user.email,
      role: user.role,
      userType: user.role.toLowerCase()
    });

    const userData = user.toJSON();

    // Prepare user response
    const userResponse = {
      id: userData.id,
      email: userData.email,
      role: userData.role.toLowerCase(),
      userType: userData.role.toLowerCase(),
      name: userData.name,
      phone: userData.phone || null,
      profileId: null // Not used in MongoDB
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

    const normalizedEmail = email.toString().trim().toLowerCase();

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Validate role
    const validRoles = ['ADMIN', 'SUPERVISOR', 'WORKER', 'CLIENT'];
    const upperRole = role.toUpperCase();
    if (!validRoles.includes(upperRole)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Must be one of: ${validRoles.join(', ')}`
      });
    }

    // Create new user (password will be hashed by pre-save hook)
    const userId = uuidv4();
    const newUser = new User({
      _id: userId,
      email: normalizedEmail,
      password, // Will be hashed by pre-save hook
      role: upperRole,
      name: name?.trim() || null,
      phone: phone?.trim() || null,
      isActive: true,
    });

    await newUser.save();
    const userData = newUser.toJSON();

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: {
        id: userData.id,
        email: userData.email,
        role: userData.role.toLowerCase(),
        userType: userData.role.toLowerCase(),
        name: userData.name,
        phone: userData.phone || null,
        createdAt: userData.createdAt
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
    // Extract userId from token payload (can be 'id' or 'userId')
    let userId = req.user?.id || req.user?.userId || req.admin?.id;

    if (!userId) {
      console.error('getCurrentUser: No userId found in request', {
        user: req.user,
        admin: req.admin
      });
      return res.status(401).json({
        success: false,
        message: 'Unauthorized'
      });
    }

    // Convert to string if it's an ObjectId or other object
    if (userId && typeof userId === 'object' && userId.toString) {
      userId = userId.toString();
    }
    userId = String(userId).trim();

    // MongoDB: Find user by ID (User model uses string _id)
    let user = await User.findById(userId).lean();
    
    // If not found, try finding by email as fallback
    if (!user && req.user?.email) {
      user = await User.findOne({ email: req.user.email.toLowerCase().trim() }).lean();
    }

    if (!user) {
      // Log for debugging but don't expose sensitive info
      console.error('getCurrentUser: User not found', {
        userId: userId?.substring(0, 10) + '...',
        email: req.user?.email,
        hasTokenPayload: !!req.user
      });
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.json({
      success: true,
      data: {
        id: user._id.toString(),
        email: user.email,
        role: user.role.toLowerCase(),
        userType: user.role.toLowerCase(),
        name: user.name,
        phone: user.phone || null,
        is_active: user.isActive !== false,
        created_at: user.createdAt
      }
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

module.exports = {
  unifiedLogin,
  createUser,
  getCurrentUser
};

