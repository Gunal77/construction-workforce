const jwt = require('jsonwebtoken');
const env = require('../config/env');

const DEFAULT_EXPIRY = env.jwtExpiresIn || '15m';

// Validate JWT_SECRET is set
if (!env.jwtSecret || env.jwtSecret.trim().length === 0) {
  throw new Error('JWT_SECRET is not set or is empty. Please check your .env file.');
}

/**
 * Sign a JWT token
 * @param {Object} payload - Token payload (userId, role, email, etc.)
 * @param {Object} options - JWT options (expiresIn, etc.)
 * @returns {string} JWT token
 */
const signToken = (payload, options = {}) => {
  return jwt.sign(payload, env.jwtSecret, {
    expiresIn: DEFAULT_EXPIRY,
    ...options,
  });
};

/**
 * Verify a JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object} Decoded token payload
 * @throws {Error} If token is invalid or expired
 */
const verifyToken = (token) => {
  if (!env.jwtSecret || env.jwtSecret.trim().length === 0) {
    throw new Error('JWT_SECRET is not configured');
  }
  return jwt.verify(token, env.jwtSecret);
};

module.exports = {
  signToken,
  verifyToken,
};

