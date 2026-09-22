// =========================================================
// backend/controllers/assignmentController.js
// =========================================================

const Assignment = require("../models/Assignment");


/* =========================================================
   HELPERS
========================================================= */

function getRole(req) {
  return String(
    req.user?.role || ""
  ).toLowerCase();
}


function isStaff(req) {
  const role =
    getRole(req);

  return (
    role === "admin" ||
    role === "teacher" ||
    role === "super-admin" ||
    role === "superadmin"
  );
}


function isStudent(req) {
  return (
    getRole(req) ===
    "student"
  );
}


/* =========================================================
   CREATE ASSIGNMENT
   POST /api/assignments
========================================================= */

exports.createAssignment =
  async (
    req,
    res,
    next
  ) => {
    try {

      if (!isStaff(req)) {
        return res.status(403).json({
          success: false,
          error:
            "You are not allowed to create assignments",
        });
      }


      const {
        title,
        description,
        gradeId,
        subjectId,
        unitId,
        lessonId,
        teacherId,
        published,
        dueDate,
        totalMarks,
        instructions,
        attachmentUrl,
        assignedStudentIds,
      } = req.body;


      if (!title?.trim()) {
        return res.status(400).json({
          success: false,
          error:
            "Assignment title is required",
        });
      }


      const assignment =
        await Assignment.create({
          title:
            title.trim(),

          description:
            description ||
            "",

          gradeId:
            gradeId ||
            null,

          subjectId:
            subjectId ||
            null,

          unitId:
            unitId ||
            null,

          lessonId:
            lessonId ||
            null,

          teacherId:
            teacherId ||
            req.user?.id ||
            null,

          published:
            published === true,

          dueDate:
            dueDate ||
            null,

          totalMarks:
            Number(
              totalMarks
            ) > 0
              ? Number(
                  totalMarks
                )
              : 100,

          instructions:
            instructions ||
            "",

          attachmentUrl:
            attachmentUrl ||
            "",

          assignedStudentIds:
            Array.isArray(
              assignedStudentIds
            )
              ? assignedStudentIds.map(
                  (id) =>
                    String(id)
                )
              : [],

          submissions: [],
        });


      res.status(201).json({
        success: true,
        assignment,
      });

    } catch (error) {

      console.error(
        "createAssignment error:",
        error
      );

      next(error);
    }
  };


/* =========================================================
   LIST ASSIGNMENTS
   GET /api/assignments
========================================================= */

exports.listAssignments =
  async (
    req,
    res,
    next
  ) => {
    try {

      const role =
        getRole(req);

      /*
      ======================================================
      STAFF
      ======================================================
      */

      if (
        role === "admin" ||
        role === "teacher" ||
        role === "super-admin" ||
        role === "superadmin"
      ) {

        const {
          gradeId,
          subjectId,
          unitId,
          lessonId,
        } = req.query;


        const filter = {};


        if (gradeId) {
          filter.gradeId =
            String(
              gradeId
            );
        }


        if (subjectId) {
          filter.subjectId =
            String(
              subjectId
            );
        }


        if (unitId) {
          filter.unitId =
            String(
              unitId
            );
        }


        if (lessonId) {
          filter.lessonId =
            String(
              lessonId
            );
        }


        const assignments =
          await Assignment.find(
            filter
          )
            .sort({
              createdAt: -1,
            })
            .lean();


        return res.json({
          success: true,

          count:
            assignments.length,

          assignments,
        });
      }


      /*
      ======================================================
      STUDENT
      ======================================================
      */

      if (
        role === "student"
      ) {

        const userId =
          String(
            req.user?.id ||
              req.user?.uid ||
              ""
          );


        if (!userId) {
          return res.status(401).json({
            success: false,
            error:
              "Student identity is missing",
          });
        }


        const assignments =
          await Assignment.find({
            published: true,

            $or: [
              {
                assignedStudentIds:
                  userId,
              },

              {
                assignedStudentIds:
                  {
                    $size: 0,
                  },
              },
            ],
          })
            .sort({
              dueDate: 1,
              createdAt: -1,
            })
            .lean();


        /*
        ----------------------------------------------------
        Return only the student's submission
        ----------------------------------------------------
        */

        const result =
          assignments.map(
            (assignment) => {

              const submission =
                Array.isArray(
                  assignment.submissions
                )
                  ? assignment.submissions.find(
                      (item) =>
                        String(
                          item.userId
                        ) === userId
                    )
                  : null;


              return {
                ...assignment,

                submissions:
                  submission
                    ? [
                        submission,
                      ]
                    : [],
              };
            }
          );


        return res.json({
          success: true,

          count:
            result.length,

          assignments:
            result,
        });
      }


      return res.status(403).json({
        success: false,
        error:
          "You are not allowed to access assignments",
      });

    } catch (error) {

      console.error(
        "listAssignments error:",
        error
      );

      next(error);
    }
  };


/* =========================================================
   GET SINGLE ASSIGNMENT
   GET /api/assignments/:id
========================================================= */

exports.getAssignment =
  async (
    req,
    res,
    next
  ) => {
    try {

      const assignment =
        await Assignment.findById(
          req.params.id
        ).lean();


      if (!assignment) {
        return res.status(404).json({
          success: false,
          error:
            "Assignment not found",
        });
      }


      const role =
        getRole(req);


      /*
      ======================================================
      STAFF
      ======================================================
      */

      if (
        role === "admin" ||
        role === "teacher" ||
        role === "super-admin" ||
        role === "superadmin"
      ) {
        return res.json({
          success: true,
          assignment,
        });
      }


      /*
      ======================================================
      STUDENT
      ======================================================
      */

      if (
        role === "student"
      ) {

        const userId =
          String(
            req.user?.id ||
              req.user?.uid ||
              ""
          );


        const isAssigned =
          assignment.assignedStudentIds
            ?.some(
              (id) =>
                String(id) ===
                userId
            );


        const isForAll =
          Array.isArray(
            assignment.assignedStudentIds
          ) &&
          assignment
            .assignedStudentIds
            .length ===
            0;


        if (
          !assignment.published ||
          (!isAssigned &&
            !isForAll)
        ) {
          return res.status(403).json({
            success: false,
            error:
              "You are not allowed to access this assignment",
          });
        }


        const submission =
          Array.isArray(
            assignment.submissions
          )
            ? assignment.submissions.find(
                (item) =>
                  String(
                    item.userId
                  ) === userId
              )
            : null;


        return res.json({
          success: true,

          assignment: {
            ...assignment,

            submissions:
              submission
                ? [submission]
                : [],
          },
        });
      }


      return res.status(403).json({
        success: false,
        error:
          "You are not allowed to access this assignment",
      });

    } catch (error) {

      console.error(
        "getAssignment error:",
        error
      );

      next(error);
    }
  };


/* =========================================================
   SUBMIT ASSIGNMENT
   POST /api/assignments/:id/submit
========================================================= */

exports.submitAssignment =
  async (
    req,
    res,
    next
  ) => {
    try {

      if (!isStudent(req)) {
        return res.status(403).json({
          success: false,
          error:
            "Only students can submit assignments",
        });
      }


      const userId =
        String(
          req.user?.id ||
            req.user?.uid ||
            ""
        );


      if (!userId) {
        return res.status(401).json({
          success: false,
          error:
            "Student identity is missing",
        });
      }


      const {
        attachmentUrl,
      } = req.body;


      const assignment =
        await Assignment.findById(
          req.params.id
        );


      if (!assignment) {
        return res.status(404).json({
          success: false,
          error:
            "Assignment not found",
        });
      }


      if (
        !assignment.published
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Assignment is not published",
        });
      }


      const assigned =
        Array.isArray(
          assignment.assignedStudentIds
        )
          ? assignment
              .assignedStudentIds
              .some(
                (id) =>
                  String(id) ===
                  userId
              )
          : false;


      const forEveryone =
        Array.isArray(
          assignment.assignedStudentIds
        ) &&
        assignment
          .assignedStudentIds
          .length === 0;


      if (
        !assigned &&
        !forEveryone
      ) {
        return res.status(403).json({
          success: false,
          error:
            "This assignment is not assigned to this student",
        });
      }


      /*
      ======================================================
      CHECK DEADLINE
      ======================================================
      */

      const now =
        new Date();

      const isLate =
        assignment.dueDate &&
        now >
          new Date(
            assignment.dueDate
          );


      /*
      ======================================================
      FIND EXISTING SUBMISSION
      ======================================================
      */

      let submission =
        assignment.submissions.find(
          (item) =>
            String(
              item.userId
            ) === userId
        );


      /*
      ======================================================
      UPDATE
      ======================================================
      */

      if (submission) {

        submission.status =
          isLate
            ? "late"
            : "submitted";

        submission.submittedAt =
          now;

        if (
          attachmentUrl !==
          undefined
        ) {
          submission.attachmentUrl =
            attachmentUrl ||
            "";
        }

      } else {

        assignment.submissions.push({
          userId,

          status:
            isLate
              ? "late"
              : "submitted",

          submittedAt:
            now,

          score: null,

          totalMarks:
            assignment.totalMarks,

          teacherComment:
            "",

          attachmentUrl:
            attachmentUrl ||
            "",
        });
      }


      await assignment.save();


      const updatedSubmission =
        assignment.submissions.find(
          (item) =>
            String(
              item.userId
            ) === userId
        );


      res.json({
        success: true,

        message:
          isLate
            ? "Assignment submitted late"
            : "Assignment submitted successfully",

        submission:
          updatedSubmission,
      });

    } catch (error) {

      console.error(
        "submitAssignment error:",
        error
      );

      next(error);
    }
  };


/* =========================================================
   GRADE ASSIGNMENT
   POST /api/assignments/:id/grade
========================================================= */

exports.gradeAssignment =
  async (
    req,
    res,
    next
  ) => {
    try {

      if (!isStaff(req)) {
        return res.status(403).json({
          success: false,
          error:
            "You are not allowed to grade assignments",
        });
      }


      const {
        userId,
        score,
        teacherComment,
      } = req.body;


      if (!userId) {
        return res.status(400).json({
          success: false,
          error:
            "userId is required",
        });
      }


      const assignment =
        await Assignment.findById(
          req.params.id
        );


      if (!assignment) {
        return res.status(404).json({
          success: false,
          error:
            "Assignment not found",
        });
      }


      const submission =
        assignment.submissions.find(
          (item) =>
            String(
              item.userId
            ) ===
            String(userId)
        );


      if (!submission) {
        return res.status(404).json({
          success: false,
          error:
            "Student submission not found",
        });
      }


      const numericScore =
        Number(score);


      if (
        !Number.isFinite(
          numericScore
        ) ||
        numericScore < 0 ||
        numericScore >
          assignment.totalMarks
      ) {
        return res.status(400).json({
          success: false,
          error:
            `Score must be between 0 and ${assignment.totalMarks}`,
        });
      }


      submission.score =
        numericScore;

      submission.totalMarks =
        assignment.totalMarks;

      submission.teacherComment =
        teacherComment ||
        "";

      submission.status =
        "graded";


      await assignment.save();


      res.json({
        success: true,

        message:
          "Assignment graded successfully",

        submission,
      });

    } catch (error) {

      console.error(
        "gradeAssignment error:",
        error
      );

      next(error);
    }
  };


/* =========================================================
   UPDATE ASSIGNMENT
   PUT /api/assignments/:id
========================================================= */

exports.updateAssignment =
  async (
    req,
    res,
    next
  ) => {
    try {

      if (!isStaff(req)) {
        return res.status(403).json({
          success: false,
          error:
            "You are not allowed to update assignments",
        });
      }


      const allowedFields = [
        "title",
        "description",
        "gradeId",
        "subjectId",
        "unitId",
        "lessonId",
        "published",
        "dueDate",
        "totalMarks",
        "instructions",
        "attachmentUrl",
        "assignedStudentIds",
      ];


      const updates = {};


      for (
        const field of
          allowedFields
      ) {
        if (
          req.body[field] !==
          undefined
        ) {
          updates[field] =
            req.body[field];
        }
      }


      if (
        updates.title !==
          undefined &&
        !String(
          updates.title
        ).trim()
      ) {
        return res.status(400).json({
          success: false,
          error:
            "Assignment title cannot be empty",
        });
      }


      if (
        updates.totalMarks !==
        undefined
      ) {
        const totalMarks =
          Number(
            updates.totalMarks
          );

        if (
          !Number.isFinite(
            totalMarks
          ) ||
          totalMarks <= 0
        ) {
          return res.status(400).json({
            success: false,
            error:
              "totalMarks must be greater than zero",
          });
        }

        updates.totalMarks =
          totalMarks;
      }


      if (
        Array.isArray(
          updates.assignedStudentIds
        )
      ) {
        updates.assignedStudentIds =
          updates.assignedStudentIds.map(
            (id) =>
              String(id)
          );
      }


      const assignment =
        await Assignment.findByIdAndUpdate(
          req.params.id,
          updates,
          {
            new: true,
            runValidators: true,
          }
        ).lean();


      if (!assignment) {
        return res.status(404).json({
          success: false,
          error:
            "Assignment not found",
        });
      }


      res.json({
        success: true,
        assignment,
      });

    } catch (error) {

      console.error(
        "updateAssignment error:",
        error
      );

      next(error);
    }
  };


/* =========================================================
   DELETE ASSIGNMENT
   DELETE /api/assignments/:id
========================================================= */

exports.deleteAssignment =
  async (
    req,
    res,
    next
  ) => {
    try {

      if (!isStaff(req)) {
        return res.status(403).json({
          success: false,
          error:
            "You are not allowed to delete assignments",
        });
      }


      const assignment =
        await Assignment.findByIdAndDelete(
          req.params.id
        );


      if (!assignment) {
        return res.status(404).json({
          success: false,
          error:
            "Assignment not found",
        });
      }


      res.json({
        success: true,

        message:
          "Assignment deleted successfully",
      });

    } catch (error) {

      console.error(
        "deleteAssignment error:",
        error
      );

      next(error);
    }
  };