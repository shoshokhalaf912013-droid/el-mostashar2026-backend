// controllers/attemptController.js

const Attempt = require("../models/Attempt");
const Exam = require("../models/Exam");
const QuestionUsage = require("../models/QuestionUsage");
const QuestionBank = require("../models/QuestionBank");


// ======================================================
// Helper — الحصول على userId
// ======================================================

function getUserId(req) {
  return req.user && req.user.id
    ? String(req.user.id)
    : null;
}


// ======================================================
// Helper — التحقق من إجابة السؤال
// ======================================================

function isQuestionAnswered(question, answer) {
  if (!answer) {
    return false;
  }

  // MCQ
  if (question.type === "mcq") {
    return Number.isInteger(
      Number(answer.choiceIndex)
    );
  }

  // Essay
  if (question.type === "essay") {
    const hasText =
      typeof answer.textAnswer === "string" &&
      answer.textAnswer.trim().length > 0;

    const hasImage =
      typeof answer.imageUrl === "string" &&
      answer.imageUrl.trim().length > 0;

    return hasText || hasImage;
  }

  return false;
}


// ======================================================
// Helper — تنظيف الإجابات القادمة من الطالب
// ======================================================

function normalizeAnswers(answers) {
  if (!Array.isArray(answers)) {
    return [];
  }

  const answerMap = new Map();

  answers.forEach((answer) => {
    if (
      !answer ||
      !Number.isInteger(
        Number(answer.questionIndex)
      )
    ) {
      return;
    }

    const questionIndex =
      Number(answer.questionIndex);

    const normalized = {
      questionIndex,
      choiceIndex: null,
      textAnswer: "",
      imageUrl: "",
      awardedMarks: null,
      teacherComment: "",
      graded: false,
    };

    // --------------------------
    // MCQ
    // --------------------------

    if (
      Number.isInteger(
        Number(answer.choiceIndex)
      )
    ) {
      normalized.choiceIndex =
        Number(answer.choiceIndex);
    }

    // --------------------------
    // Essay text
    // --------------------------

    if (
      typeof answer.textAnswer === "string"
    ) {
      normalized.textAnswer =
        answer.textAnswer.trim();
    }

    // --------------------------
    // Essay image
    // --------------------------

    if (
      typeof answer.imageUrl === "string"
    ) {
      normalized.imageUrl =
        answer.imageUrl.trim();
    }

    // --------------------------
    // Existing grading data
    // لا نحذف تصحيح المدرس
    // --------------------------

    if (
      answer.awardedMarks !== undefined &&
      answer.awardedMarks !== null &&
      answer.awardedMarks !== ""
    ) {
      const marks =
        Number(answer.awardedMarks);

      if (
        Number.isFinite(marks) &&
        marks >= 0
      ) {
        normalized.awardedMarks =
          marks;
      }
    }

    if (
      typeof answer.teacherComment === "string"
    ) {
      normalized.teacherComment =
        answer.teacherComment.trim();
    }

    if (
      answer.graded === true
    ) {
      normalized.graded = true;
    }

    answerMap.set(
      questionIndex,
      normalized
    );
  });

  return Array.from(
    answerMap.values()
  );
}


// ======================================================
// START ATTEMPT
// بدء محاولة امتحان
// ======================================================

exports.startAttempt = async (
  req,
  res,
  next
) => {
  try {

    const { examId } =
      req.body;

    const userId =
      getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error:
          "User authentication required",
      });
    }


    // --------------------------
    // التحقق من examId
    // --------------------------

    if (!examId) {
      return res.status(400).json({
        success: false,
        error:
          "examId is required",
      });
    }


    // --------------------------
    // الحصول على الامتحان
    // --------------------------

    const exam =
      await Exam.findById(examId);

    if (!exam) {
      return res.status(404).json({
        success: false,
        error:
          "Exam not found",
      });
    }


    // --------------------------
    // حالة الامتحان
    // --------------------------

    if (
      exam.status === "closed"
    ) {
      return res.status(400).json({
        success: false,
        error:
          "هذا الامتحان مغلق.",
      });
    }


    // --------------------------
    // استكمال محاولة موجودة
    // --------------------------

    const existingAttempt =
      await Attempt.findOne({
        examId: exam._id,
        userId,
        status: "in_progress",
      });

    if (existingAttempt) {
      return res.json({
        success: true,
        resumed: true,
        attemptId:
          existingAttempt._id,
        attempt:
          existingAttempt,
        exam,
      });
    }


    // --------------------------
    // مدة الامتحان
    // --------------------------

    const durationMinutes =
      Number(exam.duration) || 30;

    const remainingSeconds =
      durationMinutes * 60;


    // --------------------------
    // إنشاء Attempt
    // --------------------------

    const attempt =
      new Attempt({
        examId:
          exam._id,

        userId,

        answers: [],

        status:
          "in_progress",

        remainingSeconds,

        allowResume:
          !exam.strictMode,

        startedAt:
          new Date(),

        lastSavedAt:
          new Date(),

        lastPingAt:
          new Date(),
      });


    await attempt.save();


    // --------------------------
    // تسجيل QuestionUsage
    // --------------------------

    const bankQuestions =
      exam.questions.filter(
        (question) =>
          question.questionBankId
      );


    if (
      bankQuestions.length > 0
    ) {

      const usageDocuments =
        bankQuestions.map(
          (question) => ({
            questionId:
              question.questionBankId,

            userId,

            examId:
              exam._id,

            attemptId:
              attempt._id,

            usageType:
              "exam",

            usedAt:
              new Date(),
          })
        );


      try {

        await QuestionUsage.insertMany(
          usageDocuments,
          {
            ordered: false,
          }
        );

      } catch (usageError) {

        if (
          usageError &&
          usageError.code !== 11000 &&
          !usageError.writeErrors
        ) {
          throw usageError;
        }
      }


      const questionIds =
        bankQuestions.map(
          (question) =>
            question.questionBankId
        );


      await QuestionBank.updateMany(
        {
          _id: {
            $in: questionIds,
          },
        },
        {
          $inc: {
            usageCount: 1,
          },

          $set: {
            lastUsedAt:
              new Date(),
          },
        }
      );
    }


    // --------------------------
    // النتيجة
    // --------------------------

    res.status(201).json({
      success: true,
      resumed: false,
      attemptId:
        attempt._id,
      attempt,
      exam,
    });

  } catch (err) {

    console.error(
      "startAttempt error:",
      err
    );

    next(err);
  }
};


// ======================================================
// GET ATTEMPT
// الحصول على محاولة
// ======================================================

exports.getAttempt = async (
  req,
  res,
  next
) => {
  try {

    const userId =
      getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error:
          "User authentication required",
      });
    }


    const att =
      await Attempt.findById(
        req.params.id
      ).lean();


    if (!att) {
      return res.status(404).json({
        success: false,
        error:
          "Attempt not found",
      });
    }


    // --------------------------
    // حماية المحاولة
    // --------------------------

    if (
      att.userId &&
      String(att.userId) !== userId
    ) {
      return res.status(403).json({
        success: false,
        error:
          "You are not allowed to access this attempt",
      });
    }


    res.json({
      success: true,
      attempt: att,
    });

  } catch (err) {

    console.error(
      "getAttempt error:",
      err
    );

    next(err);
  }
};


// ======================================================
// SAVE ATTEMPT
// حفظ إجابات الطالب
// ======================================================

exports.saveAttempt = async (
  req,
  res,
  next
) => {
  try {

    const userId =
      getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error:
          "User authentication required",
      });
    }


    const { id } =
      req.params;

    const {
      answers,
      remainingSeconds,
    } = req.body;


    const att =
      await Attempt.findById(id);


    if (!att) {
      return res.status(404).json({
        success: false,
        error:
          "Attempt not found",
      });
    }


    // --------------------------
    // حماية المحاولة
    // --------------------------

    if (
      att.userId &&
      String(att.userId) !== userId
    ) {
      return res.status(403).json({
        success: false,
        error:
          "You are not allowed to modify this attempt",
      });
    }


    if (
      att.status !==
      "in_progress"
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Cannot save non in_progress attempt",
      });
    }


    // --------------------------
    // الحصول على الإجابات الحالية
    // --------------------------

    const existingAnswers =
      Array.isArray(att.answers)
        ? att.answers
        : [];


    const existingMap =
      new Map();


    existingAnswers.forEach(
      (answer) => {

        if (
          answer &&
          Number.isInteger(
            Number(answer.questionIndex)
          )
        ) {
          existingMap.set(
            Number(answer.questionIndex),
            answer
          );
        }
      }
    );


    // --------------------------
    // تحديث إجابات الطالب
    // --------------------------

    if (
      Array.isArray(answers)
    ) {

      const normalized =
        normalizeAnswers(
          answers
        );


      normalized.forEach(
        (newAnswer) => {

          const oldAnswer =
            existingMap.get(
              newAnswer.questionIndex
            );


          /*
          إذا كان هناك تصحيح سابق
          من المدرس، نحافظ عليه.
          */

          if (
            oldAnswer &&
            oldAnswer.graded === true
          ) {

            newAnswer.awardedMarks =
              oldAnswer.awardedMarks;

            newAnswer.teacherComment =
              oldAnswer.teacherComment;

            newAnswer.graded =
              oldAnswer.graded;
          }


          existingMap.set(
            newAnswer.questionIndex,
            newAnswer
          );
        }
      );


      att.answers =
        Array.from(
          existingMap.values()
        );
    }


    // --------------------------
    // الوقت المتبقي
    // --------------------------

    if (
      typeof remainingSeconds ===
      "number"
    ) {

      att.remainingSeconds =
        Math.max(
          0,
          Math.floor(
            remainingSeconds
          )
        );
    }


    att.lastSavedAt =
      new Date();

    att.lastPingAt =
      new Date();


    await att.save();


    res.json({
      success: true,
      ok: true,
    });

  } catch (err) {

    console.error(
      "saveAttempt error:",
      err
    );

    next(err);
  }
};


// ======================================================
// PING ATTEMPT
// ======================================================

exports.pingAttempt = async (
  req,
  res,
  next
) => {
  try {

    const userId =
      getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error:
          "User authentication required",
      });
    }


    const att =
      await Attempt.findById(
        req.params.id
      );


    if (!att) {
      return res.status(404).json({
        success: false,
        error:
          "Attempt not found",
      });
    }


    if (
      att.userId &&
      String(att.userId) !== userId
    ) {
      return res.status(403).json({
        success: false,
        error:
          "Not allowed",
      });
    }


    if (
      att.status !==
      "in_progress"
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Not in progress",
      });
    }


    att.lastPingAt =
      new Date();


    await att.save();


    res.json({
      success: true,
      ok: true,
    });

  } catch (err) {

    console.error(
      "pingAttempt error:",
      err
    );

    next(err);
  }
};


// ======================================================
// LEAVE ATTEMPT
// مغادرة الامتحان
// ======================================================

exports.leaveAttempt = async (
  req,
  res,
  next
) => {
  try {

    const userId =
      getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error:
          "User authentication required",
      });
    }


    const att =
      await Attempt.findById(
        req.params.id
      );


    if (!att) {
      return res.status(404).json({
        success: false,
        error:
          "Attempt not found",
      });
    }


    if (
      att.userId &&
      String(att.userId) !== userId
    ) {
      return res.status(403).json({
        success: false,
        error:
          "Not allowed",
      });
    }


    if (
      att.status !==
      "in_progress"
    ) {
      return res.json({
        success: true,
        ok: true,
        status:
          att.status,
      });
    }


    const exam =
      await Exam.findById(
        att.examId
      );


    // --------------------------
    // Strict Mode
    // --------------------------

    if (
      exam &&
      exam.strictMode
    ) {

      att.status =
        "failed";

      att.allowResume =
        false;

      att.lastSavedAt =
        new Date();


      await att.save();


      return res.json({
        success: true,
        ok: true,
        status:
          "failed",
      });
    }


    // --------------------------
    // الوضع العادي
    // --------------------------

    att.status =
      "abandoned";

    att.lastSavedAt =
      new Date();


    await att.save();


    res.json({
      success: true,
      ok: true,
      status:
        "abandoned",
    });

  } catch (err) {

    console.error(
      "leaveAttempt error:",
      err
    );

    next(err);
  }
};


// ======================================================
// SUBMIT ATTEMPT
// تسليم الامتحان
// ======================================================

exports.submitAttempt = async (
  req,
  res,
  next
) => {
  try {

    const userId =
      getUserId(req);

    if (!userId) {
      return res.status(401).json({
        success: false,
        error:
          "User authentication required",
      });
    }


    const { id } =
      req.params;


    const att =
      await Attempt.findById(id);


    if (!att) {
      return res.status(404).json({
        success: false,
        error:
          "Attempt not found",
      });
    }


    // --------------------------
    // حماية المحاولة
    // --------------------------

    if (
      att.userId &&
      String(att.userId) !== userId
    ) {
      return res.status(403).json({
        success: false,
        error:
          "You are not allowed to submit this attempt",
      });
    }


    if (
      att.status !==
      "in_progress"
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Cannot submit",
      });
    }


    // --------------------------
    // الحصول على الامتحان
    // --------------------------

    const exam =
      await Exam.findById(
        att.examId
      );


    if (!exam) {
      return res.status(404).json({
        success: false,
        error:
          "Exam not found",
      });
    }


    // --------------------------
    // إجابات الطالب
    // --------------------------

    const answers =
      Array.isArray(att.answers)
        ? att.answers
        : [];


    const answerMap =
      new Map();


    answers.forEach(
      (answer) => {

        if (
          answer &&
          Number.isInteger(
            Number(answer.questionIndex)
          )
        ) {

          answerMap.set(
            Number(answer.questionIndex),
            answer
          );
        }
      }
    );


    // --------------------------
    // التحقق من اكتمال الامتحان
    // --------------------------

    const unansweredQuestions = [];


    for (
      let i = 0;
      i < exam.questions.length;
      i++
    ) {

      const question =
        exam.questions[i];

      const answer =
        answerMap.get(i);


      if (
        !isQuestionAnswered(
          question,
          answer
        )
      ) {
        unansweredQuestions.push(
          i + 1
        );
      }
    }


    if (
      unansweredQuestions.length > 0
    ) {

      return res.status(400).json({
        success: false,
        error:
          "All questions must be answered before submit",
        unansweredQuestions,
      });
    }


    // --------------------------
    // حساب الدرجة
    // --------------------------

    let score = 0;

    let totalMarks = 0;

    let essayMarks = 0;

    let pendingEssayCount = 0;


    for (
      let i = 0;
      i < exam.questions.length;
      i++
    ) {

      const question =
        exam.questions[i];


      const answer =
        answerMap.get(i);


      const marks =
        Number(question.marks) || 1;


      totalMarks +=
        marks;


      // ==================================================
      // MCQ
      // ==================================================

      if (
        question.type ===
        "mcq"
      ) {

        const studentAnswer =
          answer
            ? Number(
                answer.choiceIndex
              )
            : null;


        const correctAnswer =
          Number(
            question.correctAnswer
          );


        if (
          Number.isInteger(
            studentAnswer
          ) &&
          studentAnswer ===
            correctAnswer
        ) {

          score +=
            marks;
        }


        continue;
      }


      // ==================================================
      // ESSAY
      // ==================================================

      if (
        question.type ===
        "essay"
      ) {

        /*
        المقالي لا يتم تصحيحه
        تلقائيًا.

        إذا كان المدرس قد صححه
        بالفعل، نضيف درجته.
        */

        if (
          answer &&
          answer.graded === true &&
          answer.awardedMarks !== null &&
          answer.awardedMarks !== undefined
        ) {

          const awarded =
            Number(
              answer.awardedMarks
            );


          if (
            Number.isFinite(
              awarded
            ) &&
            awarded >= 0
          ) {

            const safeAwarded =
              Math.min(
                awarded,
                marks
              );


            score +=
              safeAwarded;

            essayMarks +=
              safeAwarded;

          }

        } else {

          pendingEssayCount++;

        }
      }
    }


    // --------------------------
    // حفظ النتيجة
    // --------------------------

    att.score =
      score;


    att.status =
      "submitted";


    att.remainingSeconds =
      Math.max(
        0,
        Number(
          att.remainingSeconds
        ) || 0
      );


    att.lastSavedAt =
      new Date();


    att.endedAt =
      new Date();


    await att.save();


    // --------------------------
    // النسبة
    // --------------------------

    const percentage =
      totalMarks > 0
        ? Math.round(
            (score /
              totalMarks) *
              100
          )
        : 0;


    // --------------------------
    // النتيجة
    // --------------------------

    res.json({
      success: true,

      ok: true,

      score,

      total:
        totalMarks,

      questionsCount:
        exam.questions.length,

      percentage,

      essayMarks,

      pendingEssayCount,

      needsGrading:
        pendingEssayCount > 0,
    });

  } catch (err) {

    console.error(
      "submitAttempt error:",
      err
    );

    next(err);
  }
};
// ======================================================
// TEACHER / ADMIN HELPER
// التحقق من صلاحية المدرس أو الأدمن
// ======================================================

function isTeacherOrAdmin(req) {
  const role =
    req.user && req.user.role
      ? String(req.user.role).toLowerCase()
      : "";

  return (
    role === "teacher" ||
    role === "admin" ||
    role === "super-admin"
  );
}


// ======================================================
// GET ESSAY ATTEMPTS
// جلب محاولات الامتحان التي تحتوي على أسئلة مقالية
// ======================================================

exports.getEssayAttempts = async (
  req,
  res,
  next
) => {
  try {
    if (!isTeacherOrAdmin(req)) {
      return res.status(403).json({
        success: false,
        error: "Teacher or admin access required",
      });
    }

    const { examId } = req.params;

    if (!examId) {
      return res.status(400).json({
        success: false,
        error: "examId is required",
      });
    }

    const exam = await Exam.findById(examId).lean();

    if (!exam) {
      return res.status(404).json({
        success: false,
        error: "Exam not found",
      });
    }

    const essayQuestions =
      (exam.questions || []).filter(
        (question) =>
          question.type === "essay"
      );

    if (essayQuestions.length === 0) {
      return res.json({
        success: true,
        exam: {
          _id: exam._id,
          title: exam.title,
        },
        questions: [],
        attempts: [],
      });
    }

    const attempts =
      await Attempt.find({
        examId: exam._id,
        status: {
          $in: [
            "submitted",
            "failed",
          ],
        },
      })
        .sort({
          createdAt: -1,
        })
        .lean();

    const formattedAttempts =
      attempts.map((attempt) => {
        const answerMap = new Map();

        (attempt.answers || []).forEach(
          (answer) => {
            if (
              answer &&
              Number.isInteger(
                Number(
                  answer.questionIndex
                )
              )
            ) {
              answerMap.set(
                Number(
                  answer.questionIndex
                ),
                answer
              );
            }
          }
        );

        const essayAnswers =
          essayQuestions.map(
            (question, index) => {
              const questionIndex =
                exam.questions.findIndex(
                  (examQuestion) =>
                    String(
                      examQuestion._id
                    ) ===
                    String(
                      question._id
                    )
                );

              const answer =
                answerMap.get(
                  questionIndex
                );

              return {
                questionIndex,

                questionNumber:
                  question.questionNumber ||
                  questionIndex + 1,

                questionText:
                  question.questionText ||
                  "",

                marks:
                  Number(
                    question.marks
                  ) || 0,

                textAnswer:
                  answer?.textAnswer ||
                  "",

                imageUrl:
                  answer?.imageUrl ||
                  "",

                awardedMarks:
                  answer?.awardedMarks !==
                    undefined &&
                  answer?.awardedMarks !==
                    null
                    ? Number(
                        answer.awardedMarks
                      )
                    : null,

                teacherComment:
                  answer?.teacherComment ||
                  "",

                graded:
                  answer?.graded === true,
              };
            }
          );

        return {
          attemptId:
            attempt._id,

          userId:
            attempt.userId,

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

          essayAnswers,
        };
      });

    return res.json({
      success: true,

      exam: {
        _id: exam._id,
        title: exam.title,
      },

      questions:
        essayQuestions,

      attempts:
        formattedAttempts,
    });
  } catch (err) {
    console.error(
      "getEssayAttempts error:",
      err
    );

    next(err);
  }
};


// ======================================================
// GRADE ESSAY
// تصحيح سؤال مقالي
// ======================================================

exports.gradeEssay = async (
  req,
  res,
  next
) => {
  try {
    if (!isTeacherOrAdmin(req)) {
      return res.status(403).json({
        success: false,
        error: "Teacher or admin access required",
      });
    }

    const { id } = req.params;

    const {
      questionIndex,
      awardedMarks,
      teacherComment,
    } = req.body;

    if (
      questionIndex ===
        undefined ||
      questionIndex === null
    ) {
      return res.status(400).json({
        success: false,
        error:
          "questionIndex is required",
      });
    }

    const normalizedQuestionIndex =
      Number(questionIndex);

    if (
      !Number.isInteger(
        normalizedQuestionIndex
      ) ||
      normalizedQuestionIndex < 0
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Invalid questionIndex",
      });
    }

    const marks =
      Number(awardedMarks);

    if (
      !Number.isFinite(marks) ||
      marks < 0
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Invalid awardedMarks",
      });
    }

    const attempt =
      await Attempt.findById(id);

    if (!attempt) {
      return res.status(404).json({
        success: false,
        error:
          "Attempt not found",
      });
    }

    if (
      attempt.status !==
        "submitted" &&
      attempt.status !==
        "failed"
    ) {
      return res.status(400).json({
        success: false,
        error:
          "Only submitted attempts can be graded",
      });
    }

    const exam =
      await Exam.findById(
        attempt.examId
      );

    if (!exam) {
      return res.status(404).json({
        success: false,
        error:
          "Exam not found",
      });
    }

    const question =
      exam.questions[
        normalizedQuestionIndex
      ];

    if (!question) {
      return res.status(404).json({
        success: false,
        error:
          "Question not found",
      });
    }

    if (
      question.type !==
      "essay"
    ) {
      return res.status(400).json({
        success: false,
        error:
          "This question is not an essay",
      });
    }

    const maxMarks =
      Number(question.marks) || 0;

    if (marks > maxMarks) {
      return res.status(400).json({
        success: false,
        error:
          "Awarded marks cannot exceed question marks",
        maxMarks,
      });
    }

    if (
      !Array.isArray(
        attempt.answers
      )
    ) {
      attempt.answers = [];
    }

    let answer =
      attempt.answers.find(
        (item) =>
          Number(
            item.questionIndex
          ) ===
          normalizedQuestionIndex
      );

    if (!answer) {
      attempt.answers.push({
        questionIndex:
          normalizedQuestionIndex,

        choiceIndex: null,

        textAnswer: "",

        imageUrl: "",

        awardedMarks:
          marks,

        teacherComment:
          typeof teacherComment ===
          "string"
            ? teacherComment.trim()
            : "",

        graded: true,
      });

      answer =
        attempt.answers[
          attempt.answers.length - 1
        ];
    } else {
      answer.awardedMarks =
        marks;

      answer.teacherComment =
        typeof teacherComment ===
        "string"
          ? teacherComment.trim()
          : "";

      answer.graded = true;
    }

    // ==================================================
    // إعادة حساب الدرجة الكاملة
    // ==================================================

    let score = 0;

    let totalMarks = 0;

    let essayMarks = 0;

    let pendingEssayCount = 0;

    const answerMap = new Map();

    attempt.answers.forEach(
      (item) => {
        if (
          item &&
          Number.isInteger(
            Number(
              item.questionIndex
            )
          )
        ) {
          answerMap.set(
            Number(
              item.questionIndex
            ),
            item
          );
        }
      }
    );

    exam.questions.forEach(
      (examQuestion, index) => {
        const marks =
          Number(
            examQuestion.marks
          ) || 1;

        totalMarks += marks;

        const studentAnswer =
          answerMap.get(index);

        // --------------------------
        // MCQ
        // --------------------------

        if (
          examQuestion.type ===
          "mcq"
        ) {
          const selected =
            studentAnswer
              ? Number(
                  studentAnswer.choiceIndex
                )
              : null;

          const correct =
            Number(
              examQuestion.correctAnswer
            );

          if (
            Number.isInteger(
              selected
            ) &&
            selected === correct
          ) {
            score += marks;
          }

          return;
        }

        // --------------------------
        // ESSAY
        // --------------------------

        if (
          examQuestion.type ===
          "essay"
        ) {
          if (
            studentAnswer &&
            studentAnswer.graded ===
              true &&
            studentAnswer.awardedMarks !==
              null &&
            studentAnswer.awardedMarks !==
              undefined
          ) {
            const awarded =
              Number(
                studentAnswer.awardedMarks
              );

            if (
              Number.isFinite(
                awarded
              ) &&
              awarded >= 0
            ) {
              const safeAwarded =
                Math.min(
                  awarded,
                  marks
                );

              score +=
                safeAwarded;

              essayMarks +=
                safeAwarded;
            }
          } else {
            pendingEssayCount++;
          }
        }
      }
    );

    attempt.score =
      score;

    attempt.lastSavedAt =
      new Date();

    await attempt.save();

    const percentage =
      totalMarks > 0
        ? Math.round(
            (score /
              totalMarks) *
              100
          )
        : 0;

    return res.json({
      success: true,

      ok: true,

      score,

      total:
        totalMarks,

      percentage,

      essayMarks,

      pendingEssayCount,

      needsGrading:
        pendingEssayCount > 0,
    });
  } catch (err) {
    console.error(
      "gradeEssay error:",
      err
    );

    next(err);
  }
};