const express = require('express');
const bcrypt = require('bcrypt');

const env = require('../config/env');
const User = require('../models/User');
const { signToken } = require('../utils/jwt');

const router = express.Router();

// POST /supervisor/auth/login - Supervisor login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const normalizedEmail = email.toString().trim().toLowerCase();

    console.log(`[Supervisor Login] Attempting login for: ${normalizedEmail}`);

    // MongoDB: Find supervisor user - try both uppercase and lowercase role
    let supervisor = await User.findOne({
      email: normalizedEmail,
      role: 'SUPERVISOR'
    }).select('+password');

    // If not found, try lowercase
    if (!supervisor) {
      supervisor = await User.findOne({
        email: normalizedEmail,
        role: { $in: ['SUPERVISOR', 'supervisor'] }
      }).select('+password');
    }

    if (!supervisor) {
      console.log(`[Supervisor Login] User not found: ${normalizedEmail}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log(`[Supervisor Login] User found: ${supervisor.email}, role: ${supervisor.role}, isActive: ${supervisor.isActive}`);

    // Check if user is active (undefined/null defaults to active)
    if (supervisor.isActive === false) {
      console.log(`[Supervisor Login] Account inactive: ${normalizedEmail}`);
      return res.status(403).json({ 
        message: 'Account is inactive. Please contact administrator.' 
      });
    }

    // Compare password
    const isPasswordValid = await supervisor.comparePassword(password);
    if (!isPasswordValid) {
      console.log(`[Supervisor Login] Invalid password for: ${normalizedEmail}`);
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    console.log(`[Supervisor Login] Login successful for: ${normalizedEmail}`);

    // Generate token - ensure role is lowercase for consistency
    const token = signToken(
      {
        userId: supervisor._id,
        role: supervisor.role?.toLowerCase() || 'supervisor',
        email: supervisor.email,
      },
      {
        expiresIn: env.jwtExpiresIn || '7d',
      }
    );

    const userData = supervisor.toJSON();

    return res.json({
      token,
      message: 'Login successful',
      user: {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        phone: userData.phone || null,
        role: userData.role.toLowerCase(),
      },
    });
  } catch (err) {
    console.error('Supervisor login error', err);
    return res.status(500).json({ message: 'Error logging in' });
  }
});

module.exports = router;

