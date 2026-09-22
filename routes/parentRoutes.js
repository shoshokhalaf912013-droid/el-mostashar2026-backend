// =========================================================
// backend/routes/parentRoutes.js
// =========================================================

const express = require("express");

const router = express.Router();

const parentController =
  require("../controllers/parentController");

/* =========================================================
   GET MY CHILDREN
   GET /api/parents/children
========================================================= */

router.get(
  "/children",
  parentController.getChildren
);

/* =========================================================
   GET CHILD REPORT
   GET /api/parents/children/:studentId/report
========================================================= */

router.get(
  "/children/:studentId/report",
  parentController.getChildReport
);

module.exports = router;