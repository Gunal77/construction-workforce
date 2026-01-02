const express = require('express');
const { signToken } = require('../utils/jwt');
const User = require('../models/User');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// POST /api/client/signup - Client registration
router.post('/signup', async (req, res) => {
  try {
    const { name, email, phone, password, companyName, contactPerson, address } = req.body;

    // Validation
    if (!name || !email || !password || !companyName) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password, and company name are required',
      });
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address',
      });
    }

    const normalizedEmail = email.toString().trim().toLowerCase();

    // Check if user already exists
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists',
      });
    }

    // Password validation
    if (password.length < 8 || password.length > 128) {
      return res.status(400).json({
        success: false,
        message: 'Password must be between 8 and 128 characters',
      });
    }

    if (!/[A-Z]/.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must contain at least one uppercase letter',
      });
    }

    if (!/[a-z]/.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must contain at least one lowercase letter',
      });
    }

    if (!/[0-9]/.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must contain at least one number',
      });
    }

    if (!/[!@#$%^&*]/.test(password)) {
      return res.status(400).json({
        success: false,
        message: 'Password must contain at least one special character (!@#$%^&*)',
      });
    }

    // Create new user (password will be hashed by pre-save hook)
    const userId = uuidv4();
    const user = new User({
      _id: userId,
      name: name.trim(),
      email: normalizedEmail,
      password, // Will be hashed by pre-save hook
      role: 'CLIENT',
      phone: phone?.trim() || null,
      isActive: true,
    });

    await user.save();

    const userData = user.toJSON();

    return res.status(201).json({
      success: true,
      message: 'Account created successfully. Please log in.',
      data: {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: 'client',
      },
    });
  } catch (error) {
    console.error('Client signup error:', error);

    // Handle duplicate email error (MongoDB duplicate key error)
    if (error.code === 11000 || error.message.includes('duplicate')) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create account. Please try again.',
    });
  }
});

module.exports = router;

