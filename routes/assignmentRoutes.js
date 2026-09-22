// =========================================================
// backend/routes/assignmentRoutes.js
// =========================================================

const express = require("express");

const router =
  express.Router();

const assignmentController =
  require("../controllers/assignmentController");

/* =========================================================
   CREATE
========================================================= */

router.post(
  "/",
  assignmentController.createAssignment
);


/* =========================================================
   LIST
========================================================= */

router.get(
  "/",
  assignmentController.listAssignments
);


/* =========================================================
   GET ONE
========================================================= */

router.get(
  "/:id",
  assignmentController.getAssignment
);


/* =========================================================
   SUBMIT
========================================================= */

router.post(
  "/:id/submit",
  assignmentController.submitAssignment
);


/* =========================================================
   GRADE
========================================================= */

router.post(
  "/:id/grade",
  assignmentController.gradeAssignment
);


/* =========================================================
   UPDATE
========================================================= */

router.put(
  "/:id",
  assignmentController.updateAssignment
);


/* =========================================================
   DELETE
========================================================= */

router.delete(
  "/:id",
  assignmentController.deleteAssignment
);

module.exports = router;