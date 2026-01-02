const authService = require('../services/authService');

/**
 * Register a new user
 * POST /api/auth/register
 */
const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validate required fields
    if (!name || !email || !password || !role) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password, and role are required',
      });
    }

    // Register user
    const user = await authService.registerUser(name, email, password, role);

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user,
    });
  } catch (error) {
    console.error('Register error:', error);

    // Handle duplicate email error
    if (error.message.includes('already exists') || error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists',
      });
    }

    // Handle validation errors
    if (
      error.message.includes('required') ||
      error.message.includes('Invalid') ||
      error.message.includes('must be')
    ) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    // Default error
    return res.status(500).json({
      success: false,
      message: 'Failed to register user',
    });
  }
};

/**
 * Login user
 * POST /api/auth/login
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
      });
    }

    // Login user
    const { token, user } = await authService.loginUser(email, password);

    return res.json({
      success: true,
      message: 'Login successful',
      token,
      user,
    });
  } catch (error) {
    console.error('Login error:', error);

    // Handle invalid credentials
    if (error.message.includes('Invalid credentials') || error.message.includes('not found')) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    // Handle inactive account
    if (error.message.includes('inactive')) {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }

    // Handle validation errors
    if (error.message.includes('required')) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    // Default error
    return res.status(500).json({
      success: false,
      message: 'Failed to login',
    });
  }
};

module.exports = {
  register,
  login,
};
