// =========================================================
// backend/controllers/reportController.js
// =========================================================

const mongoose = require("mongoose");
const admin = require("firebase-admin");

const Attempt = require("../models/Attempt");
const Exam = require("../models/Exam");

/* =========================================================
   HELPERS
========================================================= */

function isAdminOrTeacher(req) {
  const role =
    String(req.user?.role || "")
      .toLowerCase();

  return (
    role === "admin" ||
    role === "teacher" ||
    role === "super-admin" ||
    role === "superadmin"
  );
}

function denyAccess(res) {
  return res.status(403).json({
    success: false,
    error:
      "You are not allowed to access reports",
  });
}

function round(value, digits = 2) {
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

function getExamPercentage(
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

  return (
    (numericScore /
      totalMarks) *
    100
  );
}

/* =========================================================
   FIREBASE USERS
========================================================= */

async function getFirebaseUsersMap() {
  const userMap =
    new Map();

  try {
    if (
      !admin.apps ||
      admin.apps.length === 0
    ) {
      return userMap;
    }

    let pageToken;

    do {
      const result =
        await admin
          .auth()
          .listUsers(
            1000,
            pageToken
          );

      for (
        const firebaseUser of
          result.users
      ) {
        userMap.set(
          String(
            firebaseUser.uid
          ),
          {
            uid:
              firebaseUser.uid,

            displayName:
              firebaseUser.displayName ||
              "",

            email:
              firebaseUser.email ||
              "",

            photoURL:
              firebaseUser.photoURL ||
              "",
          }
        );
      }

      pageToken =
        result.pageToken;
    } while (pageToken);

    return userMap;
  } catch (error) {
    console.error(
      "Firebase users loading error:",
      error.message
    );

    return userMap;
  }
}

/* =========================================================
   SUMMARY
   GET /api/reports/summary
========================================================= */

exports.getSummary = async (
  req,
  res,
  next
) => {
  try {
    if (!isAdminOrTeacher(req)) {
      return denyAccess(res);
    }

    const [
      attempts,
      exams,
    ] = await Promise.all([
      Attempt.find({})
        .sort({
          startedAt: -1,
        })
        .lean(),

      Exam.find({}).lean(),
    ]);

    const examMap =
      new Map(
        exams.map((exam) => [
          String(
            exam._id
          ),
          exam,
        ])
      );

    const totalAttempts =
      attempts.length;

    const submittedAttempts =
      attempts.filter(
        (attempt) =>
          attempt.status ===
          "submitted"
      );

    const inProgressAttempts =
      attempts.filter(
        (attempt) =>
          attempt.status ===
          "in_progress"
      );

    const abandonedAttempts =
      attempts.filter(
        (attempt) =>
          attempt.status ===
          "abandoned"
      );

    const failedAttempts =
      attempts.filter(
        (attempt) =>
          attempt.status ===
          "failed"
      );

    const uniqueStudents =
      new Set(
        attempts
          .map(
            (attempt) =>
              attempt.userId
          )
          .filter(Boolean)
          .map((id) =>
            String(id)
          )
      );

    let scoreSum = 0;
    let scoreCount = 0;

    let passedCount = 0;
    let failedSubmissionCount =
      0;

    for (
      const attempt of
        submittedAttempts
    ) {
      const score =
        Number(
          attempt.score
        );

      if (
        !Number.isFinite(score)
      ) {
        continue;
      }

      scoreSum += score;
      scoreCount += 1;

      const exam =
        examMap.get(
          String(
            attempt.examId
          )
        );

      const percentage =
        getExamPercentage(
          score,
          exam
        );

      if (
        percentage === null
      ) {
        continue;
      }

      if (
        percentage >= 50
      ) {
        passedCount += 1;
      } else {
        failedSubmissionCount +=
          1;
      }
    }

    const averageScore =
      scoreCount > 0
        ? scoreSum /
          scoreCount
        : 0;

    const evaluatedSubmissions =
      passedCount +
      failedSubmissionCount;

    const passRate =
      evaluatedSubmissions >
      0
        ? (passedCount /
            evaluatedSubmissions) *
          100
        : 0;

    const failRate =
      evaluatedSubmissions >
      0
        ? (failedSubmissionCount /
            evaluatedSubmissions) *
          100
        : 0;

    /* =====================================================
       TOP EXAMS
    ===================================================== */

    const examUsageMap =
      new Map();

    for (
      const attempt of
        attempts
    ) {
      if (!attempt.examId) {
        continue;
      }

      const examId =
        String(
          attempt.examId
        );

      if (
        !examUsageMap.has(
          examId
        )
      ) {
        examUsageMap.set(
          examId,
          0
        );
      }

      examUsageMap.set(
        examId,
        examUsageMap.get(
          examId
        ) + 1
      );
    }

    const topExams =
      Array.from(
        examUsageMap.entries()
      )
        .map(
          ([examId, count]) => {
            const exam =
              examMap.get(
                examId
              );

            return {
              examId,

              title:
                exam?.title ||
                exam?.name ||
                "Untitled Exam",

              attempts:
                count,
            };
          }
        )
        .sort(
          (a, b) =>
            b.attempts -
            a.attempts
        )
        .slice(0, 10);

    /* =====================================================
       RECENT ATTEMPTS
    ===================================================== */

    const recentAttempts =
      attempts
        .slice(0, 10)
        .map((attempt) => {
          const exam =
            examMap.get(
              String(
                attempt.examId
              )
            );

          return {
            _id:
              attempt._id,

            userId:
              attempt.userId,

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

            startedAt:
              attempt.startedAt,

            endedAt:
              attempt.endedAt,

            createdAt:
              attempt.createdAt,
          };
        });

    res.json({
      success: true,

      statistics: {
        totalAttempts,

        completedAttempts:
          submittedAttempts.length,

        inProgressAttempts:
          inProgressAttempts.length,

        abandonedAttempts:
          abandonedAttempts.length,

        failedAttempts:
          failedAttempts.length,

        uniqueStudents:
          uniqueStudents.size,

        averageScore:
          round(
            averageScore
          ),

        passedAttempts:
          passedCount,

        failedSubmissions:
          failedSubmissionCount,

        passRate:
          round(
            passRate
          ),

        failRate:
          round(
            failRate
          ),
      },

      topExams,

      recentAttempts,
    });
  } catch (error) {
    console.error(
      "getSummary error:",
      error
    );

    next(error);
  }
};

/* =========================================================
   EXAM REPORTS
   GET /api/reports/exams
========================================================= */

exports.getExamReports = async (
  req,
  res,
  next
) => {
  try {
    if (!isAdminOrTeacher(req)) {
      return denyAccess(res);
    }

    const [
      exams,
      submittedAttempts,
    ] = await Promise.all([
      Exam.find({}).lean(),

      Attempt.find({
        status: "submitted",
      }).lean(),
    ]);

    const reports =
      exams.map((exam) => {
        const examId =
          String(
            exam._id
          );

        const attempts =
          submittedAttempts.filter(
            (attempt) =>
              String(
                attempt.examId
              ) === examId
          );

        const totalMarks =
          getTotalMarks(exam);

        const scores =
          attempts
            .map((attempt) =>
              Number(
                attempt.score
              )
            )
            .filter(
              (score) =>
                Number.isFinite(
                  score
                )
            );

        const averageScore =
          scores.length > 0
            ? scores.reduce(
                (
                  sum,
                  score
                ) =>
                  sum + score,
                0
              ) /
              scores.length
            : 0;

        const percentages =
          attempts
            .map((attempt) =>
              getExamPercentage(
                attempt.score,
                exam
              )
            )
            .filter(
              (value) =>
                value !== null &&
                Number.isFinite(
                  value
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
            (percentage) =>
              percentage >= 50
          ).length;

        const failed =
          percentages.length -
          passed;

        return {
          examId:
            exam._id,

          title:
            exam.title ||
            exam.name ||
            "Untitled Exam",

          status:
            exam.status ||
            null,

          gradeId:
            exam.gradeId ||
            null,

          subject:
            exam.subject ||
            null,

          unitId:
            exam.unitId ||
            null,

          attemptsCount:
            attempts.length,

          questionsCount:
            Array.isArray(
              exam.questions
            )
              ? exam.questions.length
              : Number(
                  exam.questionsCount
                ) || 0,

          totalMarks,

          averageScore:
            round(
              averageScore
            ),

          averagePercentage:
            round(
              averagePercentage
            ),

          passedAttempts:
            passed,

          failedAttempts:
            failed,

          passRate:
            percentages.length >
            0
              ? round(
                  (passed /
                    percentages.length) *
                    100
                )
              : 0,
        };
      });

    reports.sort(
      (a, b) =>
        b.attemptsCount -
        a.attemptsCount
    );

    res.json({
      success: true,

      count:
        reports.length,

      reports,
    });
  } catch (error) {
    console.error(
      "getExamReports error:",
      error
    );

    next(error);
  }
};

/* =========================================================
   STUDENT LIST
   GET /api/reports/students
========================================================= */

exports.getStudents = async (
  req,
  res,
  next
) => {
  try {
    if (!isAdminOrTeacher(req)) {
      return denyAccess(res);
    }

    const [
      attempts,
      firebaseUsers,
    ] = await Promise.all([
      Attempt.find({})
        .sort({
          startedAt: -1,
        })
        .lean(),

      getFirebaseUsersMap(),
    ]);

    const studentMap =
      new Map();

    for (
      const attempt of
        attempts
    ) {
      if (!attempt.userId) {
        continue;
      }

      const userId =
        String(
          attempt.userId
        );

      if (
        !studentMap.has(
          userId
        )
      ) {
        studentMap.set(
          userId,
          {
            userId,

            attemptsCount:
              0,

            completedCount:
              0,

            lastActivity:
              attempt.startedAt ||
              attempt.createdAt ||
              null,
          }
        );
      }

      const student =
        studentMap.get(
          userId
        );

      student.attemptsCount +=
        1;

      if (
        attempt.status ===
        "submitted"
      ) {
        student.completedCount +=
          1;
      }

      const currentDate =
        attempt.startedAt ||
        attempt.createdAt ||
        null;

      if (
        currentDate &&
        (
          !student.lastActivity ||
          new Date(
            currentDate
          ) >
            new Date(
              student.lastActivity
            )
        )
      ) {
        student.lastActivity =
          currentDate;
      }
    }

    const students =
      Array.from(
        studentMap.values()
      ).map((student) => {
        const firebaseUser =
          firebaseUsers.get(
            student.userId
          );

        return {
          ...student,

          name:
            firebaseUser?.displayName ||
            "طالب بدون اسم",

          email:
            firebaseUser?.email ||
            "",

          photoURL:
            firebaseUser?.photoURL ||
            "",
        };
      });

    students.sort(
      (a, b) => {
        const dateA =
          a.lastActivity
            ? new Date(
                a.lastActivity
              ).getTime()
            : 0;

        const dateB =
          b.lastActivity
            ? new Date(
                b.lastActivity
              ).getTime()
            : 0;

        return (
          dateB -
          dateA
        );
      }
    );

    res.json({
      success: true,

      count:
        students.length,

      students,
    });
  } catch (error) {
    console.error(
      "getStudents error:",
      error
    );

    next(error);
  }
};

/* =========================================================
   STUDENT REPORT
   GET /api/reports/students/:userId
========================================================= */

exports.getStudentReport = async (
  req,
  res,
  next
) => {
  try {
    if (!isAdminOrTeacher(req)) {
      return denyAccess(res);
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

    const [
      attempts,
      exams,
      firebaseUsers,
    ] = await Promise.all([
      Attempt.find({
        userId,
      })
        .sort({
          startedAt: -1,
        })
        .lean(),

      Exam.find({}).lean(),

      getFirebaseUsersMap(),
    ]);

    const examMap =
      new Map(
        exams.map((exam) => [
          String(
            exam._id
          ),
          exam,
        ])
      );

    const firebaseUser =
      firebaseUsers.get(
        userId
      );

    const history =
      attempts.map((attempt) => {
        const exam =
          examMap.get(
            String(
              attempt.examId
            )
          );

        const totalMarks =
          getTotalMarks(
            exam
          );

        const percentage =
          getExamPercentage(
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

          totalMarks,

          percentage:
            percentage ===
            null
              ? null
              : round(
                  percentage
                ),

          startedAt:
            attempt.startedAt,

          endedAt:
            attempt.endedAt,

          answersCount:
            Array.isArray(
              attempt.answers
            )
              ? attempt.answers.length
              : 0,
        };
      });

    const completed =
      history.filter(
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

    const scores =
      completed
        .map((item) =>
          Number(
            item.score
          )
        )
        .filter((score) =>
          Number.isFinite(
            score
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

    const passedCount =
      percentages.filter(
        (percentage) =>
          percentage >= 50
      ).length;

    const failedCount =
      percentages.length -
      passedCount;

    const distribution = {
      excellent:
        percentages.filter(
          (percentage) =>
            percentage >= 90
        ).length,

      veryGood:
        percentages.filter(
          (percentage) =>
            percentage >= 80 &&
            percentage < 90
        ).length,

      good:
        percentages.filter(
          (percentage) =>
            percentage >= 70 &&
            percentage < 80
        ).length,

      needsImprovement:
        percentages.filter(
          (percentage) =>
            percentage < 70
        ).length,
    };

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

    /* =====================================================
       PROGRESS
    ===================================================== */

    const progress =
      [...completed]
        .reverse()
        .map((item, index) => ({
          index:
            index + 1,

          examTitle:
            item.examTitle,

          percentage:
            item.percentage,

          date:
            item.startedAt,
        }));

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

        attemptsCount:
          attempts.length,

        submittedCount:
          completed.length,

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

        passedAttempts:
          passedCount,

        failedAttempts:
          failedCount,

        passRate:
          percentages.length >
          0
            ? round(
                (passedCount /
                  percentages.length) *
                  100
              )
            : 0,

        distribution,
      },

      history,

      progress,
    });
  } catch (error) {
    console.error(
      "getStudentReport error:",
      error
    );

    next(error);
  }
};

/* =========================================================
   QUESTION REPORTS
   GET /api/reports/questions
========================================================= */

exports.getQuestionReports = async (
  req,
  res,
  next
) => {
  try {
    if (!isAdminOrTeacher(req)) {
      return denyAccess(res);
    }

    const [
      exams,
      attempts,
    ] = await Promise.all([
      Exam.find({
        questions: {
          $exists: true,
          $ne: [],
        },
      }).lean(),

      Attempt.find({
        status: "submitted",
      }).lean(),
    ]);

    const examMap =
      new Map(
        exams.map((exam) => [
          String(
            exam._id
          ),
          exam,
        ])
      );

    const stats =
      new Map();

    for (
      const attempt of
        attempts
    ) {
      const exam =
        examMap.get(
          String(
            attempt.examId
          )
        );

      if (!exam) {
        continue;
      }

      if (
        !Array.isArray(
          attempt.answers
        )
      ) {
        continue;
      }

      for (
        const answer of
          attempt.answers
      ) {
        if (
          !answer ||
          !Number.isInteger(
            answer.questionIndex
          )
        ) {
          continue;
        }

        const index =
          answer.questionIndex;

        const question =
          exam.questions?.[
            index
          ];

        if (!question) {
          continue;
        }

        const key =
          `${String(
            exam._id
          )}_${index}`;

        if (
          !stats.has(key)
        ) {
          stats.set(key, {
            examId:
              exam._id,

            examTitle:
              exam.title ||
              exam.name ||
              "Untitled Exam",

            questionIndex:
              index,

            questionText:
              question.text ||
              question.question ||
              "",

            totalAnswers: 0,

            correctAnswers: 0,

            wrongAnswers: 0,
          });
        }

        const item =
          stats.get(key);

        item.totalAnswers +=
          1;

        if (
          question.type ===
            "mcq" &&
          answer.choiceIndex ===
            question.correctAnswer
        ) {
          item.correctAnswers +=
            1;
        } else {
          item.wrongAnswers +=
            1;
        }
      }
    }

    const reports =
      Array.from(
        stats.values()
      )
        .map((item) => ({
          ...item,

          correctRate:
            item.totalAnswers >
            0
              ? round(
                  (item.correctAnswers /
                    item.totalAnswers) *
                    100
                )
              : 0,

          wrongRate:
            item.totalAnswers >
            0
              ? round(
                  (item.wrongAnswers /
                    item.totalAnswers) *
                    100
                )
              : 0,
        }))
        .sort(
          (a, b) =>
            b.wrongRate -
            a.wrongRate
        );

    res.json({
      success: true,

      count:
        reports.length,

      reports,
    });
  } catch (error) {
    console.error(
      "getQuestionReports error:",
      error
    );

    next(error);
  }
};