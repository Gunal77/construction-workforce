const { verifyToken } = require('../utils/jwt');

/**
 * Unified authentication middleware
 * Verifies JWT token and checks if user has required role
 */
const unifiedAuthMiddleware = (allowedRoles = []) => {
  return (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const [scheme, token] = authHeader.split(' ');

    if (!token || scheme !== 'Bearer') {
      return res.status(401).json({ 
        success: false,
        message: 'Authorization header missing or malformed' 
      });
    }

    try {
      const decoded = verifyToken(token);

      // Check if user has required role
      if (allowedRoles.length > 0 && !allowedRoles.includes(decoded.role)) {
        return res.status(403).json({ 
          success: false,
          message: `Access denied. Required role: ${allowedRoles.join(' or ')}` 
        });
      }

      // Attach user to request
      req.user = decoded;
      req.admin = decoded; // For backwards compatibility with existing code
      
      next();
    } catch (error) {
      return res.status(401).json({ 
        success: false,
        message: error.name === 'TokenExpiredError' 
          ? 'Token expired. Please log in again.' 
          : 'Invalid or expired token' 
      });
    }
  };
};

// Role-specific middleware helpers
const requireAdmin = unifiedAuthMiddleware(['admin']);
const requireClient = unifiedAuthMiddleware(['client', 'admin']);
const requireSupervisor = unifiedAuthMiddleware(['supervisor', 'admin']);
const requireStaff = unifiedAuthMiddleware(['staff', 'supervisor', 'admin']);
const requireAuthenticated = unifiedAuthMiddleware(); // Any authenticated user

module.exports = {
  unifiedAuthMiddleware,
  requireAdmin,
  requireClient,
  requireSupervisor,
  requireStaff,
  requireAuthenticated
};

