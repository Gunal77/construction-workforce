const jwt = require('jsonwebtoken');
const env = require('../config/env');

const supervisorAuthMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, env.jwtSecret);

    // Check role - handle both uppercase and lowercase
    const role = decoded.role?.toLowerCase();
    if (role !== 'supervisor') {
      console.log(`[Supervisor Auth] Access denied. Role: ${decoded.role}, Expected: supervisor`);
      return res.status(403).json({ message: 'Supervisor access required' });
    }

    req.user = decoded;
    next();
  } catch (err) {
    // Only log non-signature errors to reduce console spam
    if (err.name === 'JsonWebTokenError' && err.message === 'invalid signature') {
      return res.status(401).json({ message: 'Invalid token. Please log out and log in again.' });
    }
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired. Please log in again.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ message: 'Invalid token' });
    }
    console.error('Auth middleware error', err.name, err.message);
    return res.status(500).json({ message: 'Authentication error' });
  }
};

module.exports = supervisorAuthMiddleware;

