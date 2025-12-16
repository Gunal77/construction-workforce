const express = require('express');
const bcrypt = require('bcrypt');
const { getClient } = require('../config/db');
const { signToken } = require('../utils/jwt');

const router = express.Router();

// POST /api/client/signup - Client registration
router.post('/signup', async (req, res) => {
  const client = await getClient();
  let transactionStarted = false;
  try {
    await client.query('BEGIN');
    transactionStarted = true;

    const { name, email, phone, password, companyName, contactPerson, address } = req.body;

    // Validation
    if (!name || !email || !password || !companyName) {
      await client.query('ROLLBACK');
      transactionStarted = false;
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
    const existingUser = await client.query(
      'SELECT id FROM users WHERE LOWER(email) = $1',
      [normalizedEmail]
    );

    if (existingUser.rows.length > 0) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists',
      });
    }

    // Password validation
    if (password.length < 8 || password.length > 128) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(400).json({
        success: false,
        message: 'Password must be between 8 and 128 characters',
      });
    }

    if (!/[A-Z]/.test(password)) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(400).json({
        success: false,
        message: 'Password must contain at least one uppercase letter',
      });
    }

    if (!/[a-z]/.test(password)) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(400).json({
        success: false,
        message: 'Password must contain at least one lowercase letter',
      });
    }

    if (!/[0-9]/.test(password)) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(400).json({
        success: false,
        message: 'Password must contain at least one number',
      });
    }

    if (!/[!@#$%^&*]/.test(password)) {
      await client.query('ROLLBACK');
      transactionStarted = false;
      return res.status(400).json({
        success: false,
        message: 'Password must contain at least one special character (!@#$%^&*)',
      });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Insert into users table
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, role, user_type, name, phone, is_active, created_at)
       VALUES ($1, $2, 'client', 'client', $3, $4, TRUE, NOW())
       RETURNING id, email, name, phone, role, created_at`,
      [normalizedEmail, passwordHash, name.trim(), phone?.trim() || null]
    );

    const newUserId = userResult.rows[0].id;

    // Insert into clients profile table
    const clientProfileResult = await client.query(
      `INSERT INTO clients (user_id, company_name, contact_person, address, created_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, company_name, contact_person, address`,
      [newUserId, companyName.trim(), contactPerson?.trim() || name.trim(), address?.trim() || null]
    );

    const profileId = clientProfileResult.rows[0].id;

    // Update users.profile_id
    await client.query('UPDATE users SET profile_id = $1 WHERE id = $2', [profileId, newUserId]);

    await client.query('COMMIT');

    return res.status(201).json({
      success: true,
      message: 'Account created successfully. Please log in.',
      data: {
        id: newUserId,
        email: userResult.rows[0].email,
        name: userResult.rows[0].name,
        role: 'client',
      },
    });
  } catch (error) {
    if (transactionStarted) {
      await client.query('ROLLBACK').catch(console.error);
    }
    console.error('Client signup error:', error);

    // Handle unique constraint violation
    if (error.code === '23505') {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create account. Please try again.',
    });
  } finally {
    if (client && typeof client.release === 'function') {
      client.release();
    }
  }
});

module.exports = router;

