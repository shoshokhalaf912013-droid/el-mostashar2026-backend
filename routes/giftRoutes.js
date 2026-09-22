// routes/giftRoutes.js
const express = require('express');
const router = express.Router();
const Gift = require('../models/Gift');

// Create gift (admin)
router.post('/', async (req, res, next) => {
  try {
    const gift = new Gift(req.body);
    await gift.save();
    res.status(201).json({ gift });
  } catch (err) { next(err); }
});

// List gifts
router.get('/', async (req, res, next) => {
  try {
    const gifts = await Gift.find().sort({ createdAt: -1 }).lean();
    res.json({ gifts });
  } catch (err) { next(err); }
});

module.exports = router;
