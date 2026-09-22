// =========================================================
// backend/routes/videoSecretRoutes.js
// =========================================================

const express = require("express");

const router =
  express.Router();

const controller =
  require(
    "../controllers/videoSecretController"
  );

// =========================================================
// LESSONS
// =========================================================

router.get(
  "/lessons",
  controller.listLessons
);

// =========================================================
// VIDEO SECRETS
// =========================================================

router.get(
  "/",
  controller.listVideoSecrets
);

router.get(
  "/:lessonId",
  controller.getVideoSecret
);

router.post(
  "/:lessonId",
  controller.saveVideoSecret
);

router.delete(
  "/:lessonId",
  controller.deleteVideoSecret
);

module.exports = router;