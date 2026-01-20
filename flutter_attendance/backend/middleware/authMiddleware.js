const { verifyToken } = require('../utils/jwt');
const { getUserById } = require('../services/authService');

/**
 * JWT Authentication Middleware
 * Verifies JWT token and attaches user data to req.user
 */
const authMiddleware = async (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authorization header missing or malformed. Please provide a valid Bearer token.',
      });
    }

    // Extract token
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token not provided',
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired. Please log in again.',
        });
      }
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({
          success: false,
          message: 'Invalid token. Please log in again.',
        });
      }
      throw error;
    }

    // Get user from database to ensure user still exists and is active
    try {
      const user = await getUserById(decoded.userId);

      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          message: 'Account is inactive. Please contact administrator.',
        });
      }

      // Attach user data to request object
      // Normalize role to uppercase for consistency
      req.user = {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role?.toUpperCase() || user.role,
        id: user.id, // Also add id for compatibility
      };

      next();
    } catch (error) {
      if (error.message === 'User not found') {
        return res.status(401).json({
          success: false,
          message: 'User not found. Please log in again.',
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error',
    });
  }
};

module.exports = authMiddleware;
