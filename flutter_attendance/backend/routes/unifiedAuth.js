const express = require('express');
const router = express.Router();
const { unifiedLogin, createUser, getCurrentUser } = require('../controllers/unifiedAuthController');
const { verifyToken } = require('../utils/jwt');

// Middleware to verify any authenticated user
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');

  if (!token || scheme !== 'Bearer') {
    return res.status(401).json({ message: 'Authorization header missing or malformed' });
  }

  try {
    const decoded = verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ 
      message: error.name === 'TokenExpiredError' 
        ? 'Token expired. Please log in again.' 
        : 'Invalid or expired token' 
    });
  }
};

// POST /auth/login - Unified login for all user types
router.post('/login', unifiedLogin);

// POST /auth/register - Create new user (admin only)
router.post('/register', authMiddleware, createUser);

// GET /auth/me - Get current user profile
router.get('/me', authMiddleware, getCurrentUser);

// POST /auth/logout - Logout (client-side token deletion)
router.post('/logout', (req, res) => {
  res.json({ 
    success: true,
    message: 'Logged out successfully' 
  });
});

module.exports = router;

