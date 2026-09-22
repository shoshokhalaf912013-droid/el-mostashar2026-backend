// =========================================================
// backend/controllers/parentController.js
// =========================================================

const admin = require("firebase-admin");

const Parent = require("../models/Parent");

const Attempt = require("../models/Attempt");
const Exam = require("../models/Exam");
const Assignment = require("../models/Assignment");
const StudentProgress = require("../models/StudentProgress");


/* =========================================================
   HELPERS
========================================================= */

function round(
  value,
  digits = 2
) {
  const factor =
    10 ** digits;

  return (
    Math.round(
      (Number(value) || 0) *
        factor
    ) / factor
  );
}


function getTotalMarks(exam) {
  if (
    !exam ||
    !Array.isArray(
      exam.questions
    )
  ) {
    return 0;
  }

  return exam.questions.reduce(
    (sum, question) =>
      sum +
      (Number(
        question?.marks
      ) || 1),
    0
  );
}


function getPercentage(
  score,
  exam
) {
  const total =
    getTotalMarks(
      exam
    );

  const numericScore =
    Number(score);

  if (
    !total ||
    !Number.isFinite(
      numericScore
    )
  ) {
    return null;
  }

  return round(
    (numericScore /
      total) *
      100
  );
}


function getParentRole(
  req
) {
  return String(
    req.user?.role || ""
  ).toLowerCase();
}


async function getFirebaseUser(
  userId
) {
  try {
    if (
      !admin.apps ||
      admin.apps.length === 0
    ) {
      return null;
    }

    return await admin
      .auth()
      .getUser(
        String(userId)
      );
  } catch {
    return null;
  }
}


/* =========================================================
   PARENT AUTHORIZATION
========================================================= */

async function getParentRecord(
  req
) {
  const role =
    getParentRole(
      req
    );

  /*
  Staff يستطيع الدخول أيضًا
  من أجل الإدارة / الدعم.
  */

  if (
    role === "admin" ||
    role === "super-admin" ||
    role === "teacher" ||
    role === "superadmin"
  ) {
    return {
      isStaff: true,
      parent: null,
    };
  }


  if (role !== "parent") {
    return {
      isStaff: false,
      parent: null,
    };
  }


  if (!req.user?.id) {
    return {
      isStaff: false,
      parent: null,
    };
  }


  const parent =
    await Parent.findOne({
      userId:
        String(
          req.user.id
        ),

      active: true,
    }).lean();


  return {
    isStaff: false,
    parent,
  };
}


/* =========================================================
   GET CHILDREN
   GET /api/parents/children
========================================================= */

exports.getChildren =
  async (
    req,
    res,
    next
  ) => {
    try {

      const {
        isStaff,
        parent,
      } =
        await getParentRecord(
          req
        );


      /*
      Staff لا نستخدم له
      هذا endpoint كقائمة أبناء.
      */

      if (isStaff) {
        return res.json({
          success: true,
          children: [],
        });
      }


      if (!parent) {
        return res.status(403).json({
          success: false,
          error:
            "Parent account not configured",
        });
      }


      const children =
        Array.isArray(
          parent.children
        )
          ? parent.children.filter(
              (child) =>
                child.active !==
                false
            )
          : [];


      const enrichedChildren =
        await Promise.all(
          children.map(
            async (child) => {

              const user =
                await getFirebaseUser(
                  child.studentId
                );


              return {
                studentId:
                  child.studentId,

                studentName:
                  child.studentName ||
                  user?.displayName ||
                  "طالب",

                email:
                  user?.email ||
                  "",

                photoURL:
                  user?.photoURL ||
                  "",

                permissions:
                  child.permissions ||
                  {},

                linkedAt:
                  child.linkedAt ||
                  null,
              };
            }
          )
        );


      res.json({
        success: true,

        children:
          enrichedChildren,
      });

    } catch (error) {

      console.error(
        "getChildren error:",
        error
      );

      next(error);
    }
  };


/* =========================================================
   GET CHILD REPORT
   GET /api/parents/children/:studentId/report
========================================================= */

exports.getChildReport =
  async (
    req,
    res,
    next
  ) => {
    try {

      const {
        isStaff,
        parent,
      } =
        await getParentRecord(
          req
        );


      const studentId =
        String(
          req.params.studentId ||
            ""
        ).trim();


      if (!studentId) {
        return res.status(400).json({
          success: false,
          error:
            "studentId is required",
        });
      }


      let childAccess =
        null;


      /*
      ==============================
      STAFF
      ==============================
      */

      if (isStaff) {

        childAccess = {
          studentId,

          permissions: {
            grades: true,
            exams: true,
            assignments: true,
            attendance: true,
            lessons: true,
            progress: true,
            alerts: true,
          },
        };

      } else {

        /*
        ============================
        PARENT
        ============================
        */

        if (!parent) {
          return res.status(403).json({
            success: false,
            error:
              "Parent account not configured",
          });
        }


        childAccess =
          Array.isArray(
            parent.children
          )
            ? parent.children.find(
                (child) =>
                  String(
                    child.studentId
                  ) ===
                  studentId &&
                  child.active !==
                    false
              )
            : null;


        if (!childAccess) {
          return res.status(403).json({
            success: false,
            error:
              "You are not allowed to access this student",
          });
        }
      }


      const permissions =
        childAccess.permissions ||
        {};


      /* =================================================
         LOAD DATA
      ================================================= */

      const [
        attempts,
        exams,
        assignments,
        progress,
        firebaseUser,
      ] = await Promise.all([
        Attempt.find({
          userId: studentId,
        })
          .sort({
            startedAt: -1,
          })
          .lean(),

        Exam.find({}).lean(),

        Assignment.find({
          $or: [
            {
              assignedStudentIds:
                studentId,
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
            dueDate: -1,
          })
          .lean(),

        StudentProgress.findOne({
          userId: studentId,
        }).lean(),

        getFirebaseUser(
          studentId
        ),
      ]);


      /* =================================================
         EXAM MAP
      ================================================= */

      const examMap =
        new Map(
          exams.map(
            (exam) => [
              String(
                exam._id
              ),
              exam,
            ]
          )
        );


      /* =================================================
         EXAMS
      ================================================= */

      const examHistory =
        attempts.map(
          (attempt) => {

            const exam =
              examMap.get(
                String(
                  attempt.examId
                )
              );

            const percentage =
              getPercentage(
                attempt.score,
                exam
              );

            return {
              examId:
                attempt.examId,

              examTitle:
                exam?.title ||
                exam?.name ||
                "Untitled Exam",

              status:
                attempt.status,

              score:
                attempt.score,

              totalMarks:
                getTotalMarks(
                  exam
                ),

              percentage,

              startedAt:
                attempt.startedAt,

              endedAt:
                attempt.endedAt,
            };
          }
        );


      const completed =
        examHistory.filter(
          (item) =>
            item.status ===
              "submitted" &&
            item.percentage !==
              null
        );


      const percentages =
        completed.map(
          (item) =>
            Number(
              item.percentage
            )
        );


      const averagePercentage =
        percentages.length > 0
          ? percentages.reduce(
              (
                sum,
                value
              ) =>
                sum + value,
              0
            ) /
            percentages.length
          : 0;


      const passed =
        percentages.filter(
          (value) =>
            value >= 50
        ).length;


      const passRate =
        percentages.length > 0
          ? (
              passed /
              percentages.length
            ) *
            100
          : 0;


      /* =================================================
         ASSIGNMENTS
      ================================================= */

      let assignmentCompleted =
        0;

      let assignmentPending =
        0;

      let assignmentLate =
        0;

      let assignmentMissing =
        0;

      let assignmentScoreSum =
        0;

      let assignmentScoreCount =
        0;


      const assignmentHistory =
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
                      ) ===
                      studentId
                  )
                : null;


            let status =
              submission?.status ||
              "pending";


            if (
              !submission &&
              assignment.dueDate &&
              new Date(
                assignment.dueDate
              ) <
                new Date()
            ) {
              status =
                "missing";
            }


            if (
              status ===
                "submitted" ||
              status ===
                "graded"
            ) {
              assignmentCompleted++;
            }


            if (
              status ===
              "pending"
            ) {
              assignmentPending++;
            }


            if (
              status ===
              "late"
            ) {
              assignmentLate++;
            }


            if (
              status ===
              "missing"
            ) {
              assignmentMissing++;
            }


            if (
              submission?.score !==
                null &&
              submission?.score !==
                undefined
            ) {

              const score =
                Number(
                  submission.score
                );

              const total =
                Number(
                  submission.totalMarks ||
                    assignment.totalMarks
                );

              if (
                Number.isFinite(
                  score
                ) &&
                total > 0
              ) {

                assignmentScoreSum +=
                  (score /
                    total) *
                  100;

                assignmentScoreCount++;
              }
            }


            return {
              assignmentId:
                assignment._id,

              title:
                assignment.title,

              status,

              score:
                submission?.score ??
                null,

              totalMarks:
                submission?.totalMarks ??
                assignment.totalMarks,

              dueDate:
                assignment.dueDate,

              submittedAt:
                submission?.submittedAt ??
                null,
            };
          }
        );


      const assignmentAverage =
        assignmentScoreCount >
        0
          ? assignmentScoreSum /
            assignmentScoreCount
          : 0;


      const assignmentRate =
        assignments.length >
        0
          ? (
              assignmentCompleted /
              assignments.length
            ) *
            100
          : 0;


      /* =================================================
         LESSONS
      ================================================= */

      const lessonData =
        progress || null;


      /* =================================================
         BUILD RESPONSE
      ================================================= */

      const response = {
        success: true,

        parentView: true,

        student: {
          studentId,

          name:
            firebaseUser?.displayName ||
            "الطالب",

          email:
            firebaseUser?.email ||
            "",

          photoURL:
            firebaseUser?.photoURL ||
            "",
        },
      };


      /* =================================================
         GRADES
      ================================================= */

      if (
        permissions.grades !==
        false
      ) {
        response.grades = {
          averagePercentage:
            round(
              averagePercentage
            ),

          passRate:
            round(
              passRate
            ),

          completedExams:
            completed.length,

          passedExams:
            passed,

          failedExams:
            completed.length -
            passed,
        };
      }


      /* =================================================
         EXAMS
      ================================================= */

      if (
        permissions.exams !==
        false
      ) {
        response.exams = {
          history:
            examHistory,
        };
      }


      /* =================================================
         ASSIGNMENTS
      ================================================= */

      if (
        permissions.assignments !==
        false
      ) {
        response.assignments = {
          total:
            assignments.length,

          completed:
            assignmentCompleted,

          pending:
            assignmentPending,

          late:
            assignmentLate,

          missing:
            assignmentMissing,

          completionRate:
            round(
              assignmentRate
            ),

          averagePercentage:
            round(
              assignmentAverage
            ),

          history:
            assignmentHistory,
        };
      }


      /* =================================================
         LESSONS / PROGRESS
      ================================================= */

      if (
        permissions.lessons !==
          false ||
        permissions.progress !==
          false
      ) {

        response.lessons = {
          totalLessons:
            lessonData?.totalLessons ||
            0,

          completedLessons:
            lessonData?.completedLessons ||
            0,

          inProgressLessons:
            lessonData?.inProgressLessons ||
            0,

          overallCompletion:
            round(
              lessonData?.overallCompletion ||
                0
            ),

          studyTimeSeconds:
            lessonData?.studyTimeSeconds ||
            0,

          lastActivityAt:
            lessonData?.lastActivityAt ||
            null,
        };
      }


      res.json(
        response
      );

    } catch (error) {

      console.error(
        "getChildReport error:",
        error
      );

      next(error);
    }
  };