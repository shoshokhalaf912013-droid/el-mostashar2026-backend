// backend/routes/liveRoutes.js

const express = require("express");
const router = express.Router();

const { joinRoom } = require("../controllers/liveController");

// GET /api/live/token?room=lesson1&username=ahmed
router.get("/token", joinRoom);

module.exports = router;