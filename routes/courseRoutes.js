// backend/routes/courseRoutes.js
const express = require('express');
const router = express.Router();
const db = require('../src/db');

// simple endpoints for courses
router.get('/', async (req, res, next) => {
  try {
    const courses = await db('courses').select('*');
    res.json(courses);
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const course = await db('courses').where({ id: req.params.id }).first();
    if (!course) return res.status(404).json({ error: 'Not found' });
    res.json(course);
  } catch (err) { next(err); }
});

module.exports = router;
