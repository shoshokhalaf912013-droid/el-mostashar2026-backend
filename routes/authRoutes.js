// backend/routes/authRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../src/db');
const { signToken, hashPassword, comparePassword } = require('../src/auth');

// Users table assumed: users(id, email, password_hash, name, role, created_at)
router.post('/register', async (req, res, next) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Missing fields' });

    const existing = await db('users').where({ email }).first();
    if (existing) return res.status(409).json({ error: 'User exists' });

    const password_hash = await hashPassword(password);
    const [user] = await db('users').insert({ email, password_hash, name }).returning(['id','email','name']);
    const token = signToken({ id: user.id, email: user.email });
    res.json({ token, user });
  } catch (err) { next(err); }
});

router.post('/login', async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await db('users').where({ email }).first();
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const ok = await comparePassword(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken({ id: user.id, email: user.email });
    res.json({ token, user: { id: user.id, email: user.email, name: user.name }});
  } catch (err) { next(err); }
});

module.exports = router;
