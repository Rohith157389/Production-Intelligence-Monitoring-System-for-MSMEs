const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const { query } = require('../config/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const result = await query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);
    const user = result.rows[0];

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await query(`INSERT INTO activity_logs (user_id, activity_type, details) VALUES ($1, $2, $3)`, [user.id, 'login', JSON.stringify({ method: 'email' })]);

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, fullName: user.full_name, industryName: user.industry_name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        industryName: user.industry_name,
        location: user.location,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});



router.post('/signup', async (req, res) => {
  try {
    const { email, password, fullName, location } = req.body;
    if (!email || !password || !fullName || !location) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const emailLower = email.toLowerCase();
    
    // Check if user already exists
    let result = await query('SELECT id FROM users WHERE email = $1', [emailLower]);
    if (result.rows.length > 0) {
      return res.status(409).json({ error: 'Email is already registered' });
    }

    const hash = await bcrypt.hash(password, 10);
    const role = 'user'; // Default role for self-registered users
    const industryName = 'Default Industry';

    result = await query(
      `INSERT INTO users (email, password_hash, full_name, role, industry_name, location)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, full_name, role, industry_name, location`,
      [emailLower, hash, fullName, role, industryName, location]
    );

    const user = result.rows[0];

    await query(`INSERT INTO activity_logs (user_id, activity_type, details) VALUES ($1, $2, $3)`, [user.id, 'signup', JSON.stringify({ method: 'email' })]);

    const jwtToken = jwt.sign(
      { id: user.id, email: user.email, role: user.role, fullName: user.full_name, industryName: user.industry_name },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
    );

    res.status(201).json({
      token: jwtToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        role: user.role,
        industryName: user.industry_name,
        location: user.location,
      },
    });
  } catch (err) {
    console.error('Signup Error:', err);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

router.get('/me', authenticate, async (req, res) => {
  try {
    const result = await query(
      'SELECT id, email, full_name, role, industry_name, location, created_at FROM users WHERE id = $1',
      [req.user.id]
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      role: user.role,
      industryName: user.industry_name,
      location: user.location,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

router.post('/register', authenticate, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only admins can register users' });
  }

  try {
    const { email, password, fullName, role } = req.body;
    if (!email || !password || !fullName || !role) {
      return res.status(400).json({ error: 'All fields required' });
    }
    if (!['admin', 'factory_manager'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, full_name, role`,
      [email.toLowerCase(), hash, fullName, role]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Registration failed' });
  }
});

module.exports = router;
