// =========================================================
// backend/controllers/studentReportController.js
// =========================================================

const admin = require("firebase-admin");

const Attempt = require("../models/Attempt");
const Exam = require("../models/Exam");
const Assignment = require("../models/Assignment");
const StudentProgress = require("../models/StudentProgress");


/* =========================================================
   HELPERS
========================================================= */

function isStaff(req) {
  const role =
    String(
      req.user?.role || ""
    ).toLowerCase();

  return (
    role === "admin" ||
    role === "teacher" ||
    role === "super-admin" ||
    role === "superadmin"
  );
}


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
  const totalMarks =
    getTotalMarks(exam);

  const numericScore =
    Number(score);

  if (
    !totalMarks ||
    !Number.isFinite(
      numericScore
    )
  ) {
    return null;
  }

  return round(
    (numericScore /
      totalMarks) *
      100
  );
}


/* =========================================================
   GET FIREBASE USER
========================================================= */

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
  } catch (error) {
    console.error(
      "Firebase user error:",
      error.message
    );

    return null;
  }
}


/* =========================================================
   GET STUDENT FULL REPORT
========================================================= */

exports.getStudentFullReport =
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
            "You are not allowed to view student reports",
        });
      }


      const userId =
        String(
          req.params.userId ||
            ""
        ).trim();


      if (!userId) {
        return res.status(400).json({
          success: false,
          error:
            "userId is required",
        });
      }


      /* =================================================
         LOAD ALL DATA
      ================================================= */

      const [
        attempts,
        exams,
        assignments,
        progress,
        firebaseUser,
      ] = await Promise.all([

        Attempt.find({
          userId,
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
            dueDate: -1,
          })
          .lean(),

        StudentProgress.findOne({
          userId,
        }).lean(),

        getFirebaseUser(userId),
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
         EXAM HISTORY
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
              attemptId:
                attempt._id,

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

              answersCount:
                Array.isArray(
                  attempt.answers
                )
                  ? attempt
                      .answers
                      .length
                  : 0,
            };
          }
        );


      /* =================================================
         COMPLETED EXAMS
      ================================================= */

      const completedExams =
        examHistory.filter(
          (item) =>
            item.status ===
              "submitted" &&
            item.percentage !==
              null
        );


      const percentages =
        completedExams.map(
          (item) =>
            Number(
              item.percentage
            )
        );


      const scores =
        completedExams
          .map((item) =>
            Number(
              item.score
            )
          )
          .filter(
            (value) =>
              Number.isFinite(
                value
              )
          );


      /* =================================================
         EXAM STATISTICS
      ================================================= */

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


      const averageScore =
        scores.length > 0
          ? scores.reduce(
              (
                sum,
                value
              ) =>
                sum + value,
              0
            ) /
            scores.length
          : 0;


      const highestPercentage =
        percentages.length > 0
          ? Math.max(
              ...percentages
            )
          : 0;


      const lowestPercentage =
        percentages.length > 0
          ? Math.min(
              ...percentages
            )
          : 0;


      const passedExams =
        percentages.filter(
          (value) =>
            value >= 50
        ).length;


      const failedExams =
        percentages.length -
        passedExams;


      const passRate =
        percentages.length > 0
          ? (
              passedExams /
              percentages.length
            ) *
            100
          : 0;


      /* =================================================
         DISTRIBUTION
      ================================================= */

      const distribution = {
        excellent:
          percentages.filter(
            (value) =>
              value >= 90
          ).length,

        veryGood:
          percentages.filter(
            (value) =>
              value >= 80 &&
              value < 90
          ).length,

        good:
          percentages.filter(
            (value) =>
              value >= 70 &&
              value < 80
          ).length,

        acceptable:
          percentages.filter(
            (value) =>
              value >= 50 &&
              value < 70
          ).length,

        needsImprovement:
          percentages.filter(
            (value) =>
              value < 50
          ).length,
      };


      /* =================================================
         ASSIGNMENTS
      ================================================= */

      let assignmentsCompleted =
        0;

      let assignmentsPending =
        0;

      let assignmentsLate =
        0;

      let assignmentsMissing =
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
                      ) === userId
                  )
                : null;


            let status =
              "pending";


            if (
              submission
                ?.status
            ) {
              status =
                submission.status;

            } else if (
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
              assignmentsCompleted +=
                1;
            }


            if (
              status ===
              "pending"
            ) {
              assignmentsPending +=
                1;
            }


            if (
              status ===
              "late"
            ) {
              assignmentsLate +=
                1;
            }


            if (
              status ===
              "missing"
            ) {
              assignmentsMissing +=
                1;
            }


            if (
              submission &&
              submission.score !==
                null &&
              submission.score !==
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

                assignmentScoreCount +=
                  1;
              }
            }


            return {
              assignmentId:
                assignment._id,

              title:
                assignment.title,

              description:
                assignment.description,

              gradeId:
                assignment.gradeId,

              subjectId:
                assignment.subjectId,

              unitId:
                assignment.unitId,

              lessonId:
                assignment.lessonId,

              dueDate:
                assignment.dueDate,

              totalMarks:
                assignment.totalMarks,

              status,

              score:
                submission?.score ??
                null,

              submissionTotalMarks:
                submission?.totalMarks ??
                assignment.totalMarks,

              submittedAt:
                submission?.submittedAt ??
                null,

              teacherComment:
                submission?.teacherComment ||
                "",
            };
          }
        );


      const assignmentAverage =
        assignmentScoreCount >
        0
          ? assignmentScoreSum /
            assignmentScoreCount
          : 0;


      const assignmentCompletionRate =
        assignments.length >
        0
          ? (
              assignmentsCompleted /
              assignments.length
            ) *
            100
          : 0;


      /* =================================================
         LESSON PROGRESS
      ================================================= */

      const lessonProgress =
        Array.isArray(
          progress?.lessons
        )
          ? progress.lessons
          : [];


      /* =================================================
         FINAL STUDENT REPORT
      ================================================= */

      res.json({
        success: true,

        student: {
          userId,

          name:
            firebaseUser?.displayName ||
            "طالب بدون اسم",

          email:
            firebaseUser?.email ||
            "",

          photoURL:
            firebaseUser?.photoURL ||
            "",
        },


        academic: {

          averageScore:
            round(
              averageScore
            ),

          averagePercentage:
            round(
              averagePercentage
            ),

          highestPercentage:
            round(
              highestPercentage
            ),

          lowestPercentage:
            round(
              lowestPercentage
            ),

          passedExams,

          failedExams,

          passRate:
            round(
              passRate
            ),

          attemptsCount:
            attempts.length,

          completedExams:
            completedExams.length,

          distribution,
        },


        exams: {
          history:
            examHistory,
        },


        assignments: {

          total:
            assignments.length,

          completed:
            assignmentsCompleted,

          pending:
            assignmentsPending,

          late:
            assignmentsLate,

          missing:
            assignmentsMissing,

          completionRate:
            round(
              assignmentCompletionRate
            ),

          averagePercentage:
            round(
              assignmentAverage
            ),

          history:
            assignmentHistory,
        },


        lessons: {

          totalLessons:
            progress?.totalLessons ||
            0,

          completedLessons:
            progress?.completedLessons ||
            0,

          inProgressLessons:
            progress?.inProgressLessons ||
            0,

          overallCompletion:
            round(
              progress?.overallCompletion ||
                0
            ),

          studyTimeSeconds:
            progress?.studyTimeSeconds ||
            0,

          lastActivityAt:
            progress?.lastActivityAt ||
            null,

          lessons:
            lessonProgress,
        },


        progress: {

          overallExamPerformance:
            round(
              averagePercentage
            ),

          assignmentPerformance:
            round(
              assignmentAverage
            ),

          lessonCompletion:
            round(
              progress?.overallCompletion ||
                0
            ),
        },

        generatedAt:
          new Date(),
      });

    } catch (error) {

      console.error(
        "getStudentFullReport error:",
        error
      );

      next(error);
    }
  };