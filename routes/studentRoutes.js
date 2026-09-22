// routes/studentRoutes.js
const express = require('express');
const router = express.Router();
const studentController = require('../controllers/studentController');

router.get('/attempts', studentController.listAttempts);
router.get('/attempts/:id', studentController.getAttempt);

router.get('/gifts', studentController.listGifts);
router.post('/gifts/claim', studentController.claimGift);

module.exports = router;
