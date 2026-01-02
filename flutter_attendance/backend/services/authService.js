const User = require('../models/User');
const { signToken } = require('../utils/jwt');
const { v4: uuidv4 } = require('uuid');
const env = require('../config/env');

/**
 * Register a new user
 * @param {string} name - User's full name
 * @param {string} email - User's email address
 * @param {string} password - User's password (will be hashed)
 * @param {string} role - User's role (ADMIN, SUPERVISOR, WORKER)
 * @returns {Promise<Object>} User object without password
 */
const registerUser = async (name, email, password, role) => {
  // Validate input
  if (!name || !email || !password || !role) {
    throw new Error('Name, email, password, and role are required');
  }

  // Validate role
  const validRoles = ['ADMIN', 'SUPERVISOR', 'WORKER'];
  if (!validRoles.includes(role.toUpperCase())) {
    throw new Error(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
  }

  // Validate email format
  const emailRegex = /^\S+@\S+\.\S+$/;
  if (!emailRegex.test(email)) {
    throw new Error('Invalid email format');
  }

  // Validate password length
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters long');
  }

  // Normalize email
  const normalizedEmail = email.trim().toLowerCase();

  // Check if user already exists
  const existingUser = await User.findOne({ email: normalizedEmail }).select('+password');
  if (existingUser) {
    throw new Error('User with this email already exists');
  }

  // Create new user
  const userId = uuidv4();
  const user = new User({
    _id: userId,
    name: name.trim(),
    email: normalizedEmail,
    password, // Will be hashed by pre-save hook
    role: role.toUpperCase(),
    isActive: true,
  });

  await user.save();

  // Return user without password
  return user.toJSON();
};

/**
 * Login user and generate JWT token
 * @param {string} email - User's email address
 * @param {string} password - User's password
 * @returns {Promise<Object>} Object containing token and user data
 */
const loginUser = async (email, password) => {
  // Validate input
  if (!email || !password) {
    throw new Error('Email and password are required');
  }

  // Normalize email
  const normalizedEmail = email.trim().toLowerCase();

  // Find user and include password field
  const user = await User.findOne({ email: normalizedEmail }).select('+password');

  if (!user) {
    throw new Error('Invalid credentials');
  }

  // Check if user is active
  if (!user.isActive) {
    throw new Error('Account is inactive. Please contact administrator.');
  }

  // Compare password
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new Error('Invalid credentials');
  }

  // Generate JWT token
  const token = signToken(
    {
      userId: user._id,
      role: user.role,
      email: user.email,
    },
    {
      expiresIn: env.jwtExpiresIn || '15m',
    }
  );

  // Return user data without password
  const userData = user.toJSON();

  return {
    token,
    user: userData,
  };
};

/**
 * Get user by ID
 * @param {string} userId - User ID
 * @returns {Promise<Object>} User object without password
 */
const getUserById = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    throw new Error('User not found');
  }
  return user.toJSON();
};

module.exports = {
  registerUser,
  loginUser,
  getUserById,
};

