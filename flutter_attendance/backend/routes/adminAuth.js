const express = require('express');
const bcrypt = require('bcrypt');

const env = require('../config/env');
const User = require('../models/User');
const { signToken } = require('../utils/jwt');

const router = express.Router();

router.post('/signup', async (req, res) => {
  try {
    // MongoDB uses /api/auth/register endpoint
    return res.status(400).json({ 
      message: 'Use /api/auth/register endpoint for MongoDB registration' 
    });
  } catch (err) {
    console.error('Admin signup error', err);
    return res.status(500).json({ message: 'Error creating admin' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password, source } = req.body; // source: 'admin-portal' or 'mobile-app'

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const normalizedEmail = email.toString().trim().toLowerCase();

    // MongoDB implementation
    // Find user with ADMIN role
    const user = await User.findOne({ 
      email: normalizedEmail,
      role: 'ADMIN'
    }).select('+password');

    if (!user) {
      // Don't reveal if email exists or not for security
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({ 
        message: 'Account is inactive. Please contact administrator.' 
      });
    }

    // Enforce role-based access: Admin can only login from admin portal
    if (source === 'mobile-app') {
      return res.status(403).json({ 
        message: 'Admin accounts can only access the Admin Portal. Please use the web application.' 
      });
    }

    // Compare password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token using the new JWT utility (with userId field)
    const token = signToken(
      {
        userId: user._id,
        role: user.role,
        email: user.email,
      },
      {
        expiresIn: env.jwtExpiresIn || '1d',
      }
    );

    // Return user data
    const userData = user.toJSON();

    return res.json({
      token,
      message: 'Login successful',
      user: {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: userData.role.toLowerCase(),
      },
    });
  } catch (err) {
    console.error('Admin login error', err);
    return res.status(500).json({ message: 'Error logging in' });
  }
});

module.exports = router;


