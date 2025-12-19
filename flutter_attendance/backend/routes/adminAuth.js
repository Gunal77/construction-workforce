const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

const { supabase } = require('../config/supabaseClient');
const env = require('../config/env');

const router = express.Router();

router.post('/signup', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const normalizedEmail = email.toString().trim().toLowerCase();
    if (!normalizedEmail.includes('@')) {
      return res.status(400).json({ message: 'A valid email address is required' });
    }

    const { data: existingAdmin, error: fetchError } = await supabase
      .from('admins')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle();

    if (fetchError) {
      return res.status(500).json({ message: fetchError.message || 'Failed to check existing admin' });
    }

    if (existingAdmin) {
      return res.status(409).json({ message: 'Admin with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const adminRow = {
      id: crypto.randomUUID(),
      email: normalizedEmail,
      password_hash: passwordHash,
    };

    const { error: insertError } = await supabase.from('admins').insert([adminRow]);

    if (insertError) {
      return res.status(400).json({ message: insertError.message || 'Failed to create admin' });
    }

    return res.json({ message: 'Admin created successfully' });
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

    // Only select needed fields for faster query - use limit(1) for optimization
    const { data: admin, error } = await supabase
      .from('admins')
      .select('id, email, password_hash, status')
      .eq('email', normalizedEmail)
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Supabase query error:', error);
      return res.status(500).json({ message: error.message || 'Failed to fetch admin' });
    }

    if (!admin) {
      // Don't reveal if email exists or not for security
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Check if admin is inactive
    if (admin.status === 'inactive') {
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

    // Compare password - this is async but should be fast
    const passwordMatch = await bcrypt.compare(password, admin.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Generate token quickly
    const token = jwt.sign(
      { id: admin.id, role: 'admin', email: admin.email },
      env.jwtSecret,
      { expiresIn: '1d' },
    );

    // Return immediately
    return res.json({
      token,
      message: 'Login successful',
      user: { id: admin.id, email: admin.email, role: 'admin' },
    });
  } catch (err) {
    console.error('Admin login error', err);
    return res.status(500).json({ message: 'Error logging in' });
  }
});

module.exports = router;


