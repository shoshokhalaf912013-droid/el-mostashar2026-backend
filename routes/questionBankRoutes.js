// routes/questionBankRoutes.js

const express = require("express");
const router = express.Router();

const QuestionBank = require("../models/QuestionBank");

// ======================================================
// GET — جميع أسئلة بنك الأسئلة
// ======================================================

router.get("/", async (req, res) => {
  try {
    const {
      stageId,
      gradeId,
      subjectId,
      unitId,
      lessonId,
      type,
      difficulty,
      active,
      search,
      page = 1,
      limit = 50,
    } = req.query;

    const filter = {};

    if (stageId) filter.stageId = stageId;
    if (gradeId) filter.gradeId = gradeId;
    if (subjectId) filter.subjectId = subjectId;
    if (unitId) filter.unitId = unitId;
    if (lessonId) filter.lessonId = lessonId;
    if (type) filter.type = type;
    if (difficulty) filter.difficulty = difficulty;

    if (active !== undefined) {
      filter.active = active === "true";
    }

    if (search) {
      filter.questionText = {
        $regex: search,
        $options: "i",
      };
    }

    const pageNumber = Math.max(Number(page), 1);

    const limitNumber = Math.min(
      Math.max(Number(limit), 1),
      200
    );

    const skip =
      (pageNumber - 1) * limitNumber;

    const [questions, total] =
      await Promise.all([
        QuestionBank.find(filter)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(limitNumber)
          .lean(),

        QuestionBank.countDocuments(filter),
      ]);

    res.json({
      success: true,
      questions,
      pagination: {
        page: pageNumber,
        limit: limitNumber,
        total,
        pages: Math.ceil(
          total / limitNumber
        ),
      },
    });
  } catch (err) {
    console.error(
      "Question Bank GET error:",
      err
    );

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ======================================================
// GET — سؤال واحد
// ======================================================

router.get("/:id", async (req, res) => {
  try {
    const question =
      await QuestionBank.findById(
        req.params.id
      );

    if (!question) {
      return res.status(404).json({
        success: false,
        error: "Question not found",
      });
    }

    res.json({
      success: true,
      question,
    });
  } catch (err) {
    console.error(
      "Question Bank GET ONE error:",
      err
    );

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ======================================================
// POST — إضافة سؤال جديد
// ======================================================

router.post("/", async (req, res) => {
  try {
    const {
      questionText,

      type = "mcq",

      choices = [],

      choiceLayout = "vertical",

      correctAnswer = null,

      modelAnswer = "",

      gradingCriteria = [],

      marks = 1,

      stageId = "",

      gradeId = "",

      subjectId = "",

      unitId = "",

      lessonId = "",

      difficulty = "medium",

      source = "teacher",

      sourceName = "",

      explanation = "",

      aiGenerated = false,

      aiReviewed = false,

      active = true,
    } = req.body;

    // ==================================================
    // التحقق الأساسي
    // ==================================================

    if (
      !questionText ||
      !questionText.trim()
    ) {
      return res.status(400).json({
        success: false,
        error: "نص السؤال مطلوب.",
      });
    }

    if (
      !["mcq", "essay"].includes(type)
    ) {
      return res.status(400).json({
        success: false,
        error:
          "نوع السؤال يجب أن يكون mcq أو essay.",
      });
    }

    // ==================================================
    // تطبيع النص لمنع التكرار
    // ==================================================

    const normalizedText =
      questionText
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

    // ==================================================
    // البحث عن سؤال مكرر في نفس الدرس
    // ==================================================

    const duplicate =
      await QuestionBank.findOne({
        lessonId,
        normalizedText,
        active: true,
      });

    if (duplicate) {
      return res.status(409).json({
        success: false,
        duplicate: true,
        error:
          "هذا السؤال موجود بالفعل في بنك أسئلة هذا الدرس.",
        questionId: duplicate._id,
      });
    }

    // ==================================================
    // MCQ
    // ==================================================

    if (type === "mcq") {
      if (
        !Array.isArray(choices) ||
        choices.length !== 4
      ) {
        return res.status(400).json({
          success: false,
          error:
            "سؤال الاختيار من متعدد يجب أن يحتوي على 4 اختيارات.",
        });
      }

      if (
        correctAnswer === null ||
        correctAnswer === undefined ||
        correctAnswer < 0 ||
        correctAnswer > 3
      ) {
        return res.status(400).json({
          success: false,
          error:
            "يجب تحديد الإجابة الصحيحة من 0 إلى 3.",
        });
      }
    }

    // ==================================================
    // ESSAY
    // ==================================================

    if (type === "essay") {
      if (
        !modelAnswer ||
        !modelAnswer.trim()
      ) {
        return res.status(400).json({
          success: false,
          error:
            "السؤال المقالي يحتاج إلى نموذج إجابة.",
        });
      }
    }

    // ==================================================
    // إنشاء السؤال
    // ==================================================

    const question =
      new QuestionBank({
        questionText:
          questionText.trim(),

        type,

        choices:
          type === "mcq"
            ? choices
            : [],

        choiceLayout:
          type === "mcq"
            ? [
                "vertical",
                "row4",
                "grid2x2",
              ].includes(choiceLayout)
              ? choiceLayout
              : "vertical"
            : "vertical",

        correctAnswer:
          type === "mcq"
            ? correctAnswer
            : null,

        modelAnswer:
          type === "essay"
            ? modelAnswer.trim()
            : "",

        gradingCriteria:
          type === "essay"
            ? gradingCriteria
            : [],

        marks,

        stageId,

        gradeId,

        subjectId,

        unitId,

        lessonId,

        difficulty,

        source,

        sourceName,

        explanation,

        aiGenerated,

        aiReviewed,

        normalizedText,

        active,
      });

    await question.save();

    res.status(201).json({
      success: true,
      message:
        "تمت إضافة السؤال إلى بنك الأسئلة بنجاح.",
      question,
    });
  } catch (err) {
    console.error(
      "Question Bank CREATE error:",
      err
    );

    res.status(400).json({
      success: false,
      error: err.message,
    });
  }
});

// ======================================================
// PUT — تعديل سؤال
// ======================================================

router.put("/:id", async (req, res) => {
  try {
    const question =
      await QuestionBank.findById(
        req.params.id
      );

    if (!question) {
      return res.status(404).json({
        success: false,
        error: "Question not found",
      });
    }

    const allowedFields = [
      "questionText",

      "type",

      "choices",

      "choiceLayout",

      "correctAnswer",

      "modelAnswer",

      "gradingCriteria",

      "marks",

      "stageId",

      "gradeId",

      "subjectId",

      "unitId",

      "lessonId",

      "difficulty",

      "source",

      "sourceName",

      "explanation",

      "aiGenerated",

      "aiReviewed",

      "active",
    ];

    for (const field of allowedFields) {
      if (
        req.body[field] !== undefined
      ) {
        question[field] =
          req.body[field];
      }
    }

    if (question.questionText) {
      question.normalizedText =
        question.questionText
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();
    }

    if (
      question.type === "mcq" &&
      ![
        "vertical",
        "row4",
        "grid2x2",
      ].includes(
        question.choiceLayout
      )
    ) {
      question.choiceLayout =
        "vertical";
    }

    await question.save();

    res.json({
      success: true,
      message:
        "تم تعديل السؤال بنجاح.",
      question,
    });
  } catch (err) {
    console.error(
      "Question Bank UPDATE error:",
      err
    );

    res.status(400).json({
      success: false,
      error: err.message,
    });
  }
});

// ======================================================
// DELETE — حذف السؤال
// ======================================================

router.delete("/:id", async (req, res) => {
  try {
    const question =
      await QuestionBank.findById(
        req.params.id
      );

    if (!question) {
      return res.status(404).json({
        success: false,
        error: "Question not found",
      });
    }

    // ==================================================
    // حذف منطقي وليس حذفًا نهائيًا
    // ==================================================

    question.active = false;

    await question.save();

    res.json({
      success: true,
      message:
        "تم تعطيل السؤال من بنك الأسئلة.",
    });
  } catch (err) {
    console.error(
      "Question Bank DELETE error:",
      err
    );

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

// ======================================================
// POST — اختيار أسئلة عشوائية من درس
// ======================================================

router.post(
  "/random/select",
  async (req, res) => {
    try {
      const {
        lessonId,

        count = 10,

        type,

        difficulty,

        excludeIds = [],
      } = req.body;

      if (!lessonId) {
        return res.status(400).json({
          success: false,
          error: "lessonId مطلوب.",
        });
      }

      const number =
        Math.max(Number(count), 1);

      const filter = {
        lessonId,

        active: true,
      };

      if (type) {
        filter.type = type;
      }

      if (difficulty) {
        filter.difficulty =
          difficulty;
      }

      if (
        Array.isArray(excludeIds) &&
        excludeIds.length > 0
      ) {
        filter._id = {
          $nin: excludeIds,
        };
      }

      const questions =
        await QuestionBank.aggregate([
          {
            $match: filter,
          },

          {
            $sample: {
              size: number,
            },
          },
        ]);

      res.json({
        success: true,
        count: questions.length,
        questions,
      });
    } catch (err) {
      console.error(
        "Question Bank RANDOM error:",
        err
      );

      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  }
);

// ======================================================
// POST — تسجيل استخدام الأسئلة
// ======================================================

router.post(
  "/mark-used",
  async (req, res) => {
    try {
      const {
        questionIds = [],
      } = req.body;

      if (
        !Array.isArray(questionIds) ||
        questionIds.length === 0
      ) {
        return res.status(400).json({
          success: false,
          error:
            "questionIds مطلوب.",
        });
      }

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
            lastUsedAt: new Date(),
          },
        }
      );

      res.json({
        success: true,
        message:
          "تم تسجيل استخدام الأسئلة.",
      });
    } catch (err) {
      console.error(
        "Question Bank MARK USED error:",
        err
      );

      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  }
);

// ======================================================
// EXPORT
// ======================================================

module.exports = router;