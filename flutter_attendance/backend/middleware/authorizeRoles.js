/**
 * Role-Based Authorization Middleware
 * Must be used after authMiddleware
 * 
 * @param {...string} allowedRoles - Roles that are allowed to access the route
 * @returns {Function} Express middleware function
 * 
 * @example
 * router.get('/admin-only', authMiddleware, authorizeRoles('ADMIN'), controller.getAdminData);
 * router.post('/supervisor-or-admin', authMiddleware, authorizeRoles('ADMIN', 'SUPERVISOR'), controller.createData);
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    // Ensure authMiddleware was called first
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Normalize roles to uppercase
    const normalizedAllowedRoles = allowedRoles.map((role) => role.toUpperCase());
    const userRole = req.user.role.toUpperCase();

    // Check if user's role is in allowed roles
    if (!normalizedAllowedRoles.includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role: ${normalizedAllowedRoles.join(' or ')}`,
      });
    }

    next();
  };
};

module.exports = authorizeRoles;

