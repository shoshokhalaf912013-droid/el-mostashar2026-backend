// =========================================================
// backend/routes/reportRoutes.js
// =========================================================

const express = require("express");

const router =
  express.Router();

const reportController =
  require("../controllers/reportController");

/* =========================================================
   SUMMARY
========================================================= */

router.get(
  "/summary",
  reportController.getSummary
);

/* =========================================================
   STUDENTS LIST

   مهم:
   هذا route يجب أن يكون قبل:

   /students/:userId
========================================================= */

router.get(
  "/students",
  reportController.getStudents
);

/* =========================================================
   STUDENT DETAILS
========================================================= */

router.get(
  "/students/:userId",
  reportController.getStudentReport
);

/* =========================================================
   EXAMS
========================================================= */

router.get(
  "/exams",
  reportController.getExamReports
);

/* =========================================================
   QUESTIONS
========================================================= */

router.get(
  "/questions",
  reportController.getQuestionReports
);

module.exports = router;