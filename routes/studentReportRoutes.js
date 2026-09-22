// =========================================================
// backend/routes/studentReportRoutes.js
// =========================================================

const express = require("express");

const router = express.Router();

const studentReportController =
  require("../controllers/studentReportController");

/* =========================================================
   STUDENT FULL REPORT
   GET /api/student-reports/:userId
========================================================= */

router.get(
  "/:userId",
  studentReportController.getStudentFullReport
);

module.exports = router;