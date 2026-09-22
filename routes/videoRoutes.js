// =========================================================
// backend/routes/videoRoutes.js
// =========================================================

const express = require("express");
const auth = require("../middlewares/auth");
const videoController = require("../controllers/videoController");

const router = express.Router();

// Secure short-lived playback gate.
// This route intentionally does NOT use Firebase auth because
// the browser loads it as an iframe URL.
router.get(
  "/:lessonId/gate/:sessionId",
  videoController.serveVideoGate
);

// All platform API routes below require Firebase authentication.
// This intentionally covers students and all staff roles.
router.get(
  "/:lessonId/status",
  auth,
  videoController.getVideoStatus
);

router.get(
  "/:lessonId/access",
  auth,
  videoController.getVideoAccess
);

router.get(
  "/:lessonId/session/:sessionId",
  auth,
  videoController.validateSession
);

module.exports = router;
