const express = require("express");
const router = express.Router();

const Exam = require("../models/Exam");
const QuestionBank = require("../models/QuestionBank");

const {
  selectRandomQuestions,
} = require("../utils/questionSelector");

/*
========================================================
EXAM ROUTES
إدارة الامتحانات
========================================================

مصادر إنشاء الامتحان:

1. question-bank
2. manual
3. ai
4. file

========================================================
*/


// ======================================================
// GET — جميع الامتحانات
// ======================================================

router.get("/", async (req, res) => {
  try {
    const exams = await Exam.find()
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      exams,
    });

  } catch (err) {

    console.error(
      "Error fetching exams:",
      err
    );

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});


// ======================================================
// GET — امتحان واحد
// ======================================================

router.get("/:id", async (req, res) => {
  try {

    const exam =
      await Exam.findById(
        req.params.id
      );

    if (!exam) {
      return res.status(404).json({
        success: false,
        error: "Exam not found",
      });
    }

    res.json({
      success: true,
      exam,
    });

  } catch (err) {

    console.error(
      "Error fetching exam:",
      err
    );

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});


// ======================================================
// POST — إنشاء امتحان يدوي
// ======================================================
// ======================================================
// PUT — نشر الامتحان
// ======================================================

router.put("/:id/publish", async (req, res) => {
  try {
    const exam = await Exam.findByIdAndUpdate(
      req.params.id,
      {
        status: "published",
        updatedAt: new Date(),
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!exam) {
      return res.status(404).json({
        success: false,
        error: "Exam not found",
      });
    }

    res.json({
      success: true,
      message: "تم نشر الامتحان بنجاح.",
      exam,
    });

  } catch (err) {
    console.error(
      "Error publishing exam:",
      err
    );

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});


// ======================================================
// PUT — إلغاء نشر الامتحان
// ======================================================

router.put("/:id/unpublish", async (req, res) => {
  try {
    const exam = await Exam.findByIdAndUpdate(
      req.params.id,
      {
        status: "draft",
        updatedAt: new Date(),
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!exam) {
      return res.status(404).json({
        success: false,
        error: "Exam not found",
      });
    }

    res.json({
      success: true,
      message: "تم إرجاع الامتحان إلى المسودة.",
      exam,
    });

  } catch (err) {
    console.error(
      "Error unpublishing exam:",
      err
    );

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});

router.post("/", async (req, res) => {

  try {

    const {
      title,
      description = "",
      subject = "",
      stageId = "",
      gradeId = "",
      unitId = "",

      duration = 30,

      withGifts = false,

      questions = [],

      creationSource = "manual",

      status = "draft",

      allowPrevious = true,

      strictMode = false,
    } = req.body;


    if (
      !title ||
      !title.trim()
    ) {

      return res.status(400).json({
        success: false,
        error: "عنوان الامتحان مطلوب.",
      });
    }


    /*
    ==============================
    التحقق من المصدر
    ==============================
    */

    const allowedSources = [
      "question-bank",
      "manual",
      "ai",
      "file",
    ];

    if (
      !allowedSources.includes(
        creationSource
      )
    ) {

      return res.status(400).json({
        success: false,
        error:
          "مصدر إنشاء الامتحان غير صحيح.",
      });
    }


    /*
    ==============================
    إنشاء الامتحان
    ==============================
    */

    const exam =
      new Exam({

        title:
          title.trim(),

        description,

        subject,

        stageId,

        gradeId,

        unitId,

        duration,

        withGifts,

        questions,

        creationSource,

        status,

        allowPrevious,

        strictMode,

      });


    await exam.save();


    res.status(201).json({
      success: true,

      message:
        "تم إنشاء الامتحان بنجاح.",

      exam,
    });

  } catch (err) {

    console.error(
      "Error adding exam:",
      err
    );

    res.status(400).json({
      success: false,
      error: err.message,
    });
  }
});


// ======================================================
// POST — إنشاء امتحان من بنك الأسئلة
// ======================================================

router.post(
  "/from-question-bank",
  async (req, res) => {

    try {

      const {
        title,

        description = "",

        subject = "",

        stageId = "",

        gradeId = "",

        unitId = "",

        duration = 30,

        withGifts = false,

        lessonIds = [],

        count = 10,

        type,

        difficulty = "any",

        avoidPreviousUsage = true,

        userId = null,

        allowPrevious = true,

        strictMode = false,

        status = "draft",
      } = req.body;


      /*
      ==============================
      التحقق من العنوان
      ==============================
      */

      if (
        !title ||
        !title.trim()
      ) {

        return res.status(400).json({
          success: false,
          error:
            "عنوان الامتحان مطلوب.",
        });
      }


      /*
      ==============================
      التحقق من الدروس
      ==============================
      */

      if (
        !Array.isArray(
          lessonIds
        ) ||
        lessonIds.length === 0
      ) {

        return res.status(400).json({
          success: false,
          error:
            "يجب تحديد درس واحد على الأقل.",
        });
      }


      /*
      ==============================
      التحقق من العدد
      ==============================
      */

      const requestedCount =
        Math.max(
          Number(count) || 1,
          1
        );


      /*
      ==============================
      اختيار الأسئلة
      ==============================
      */

      let selectedQuestions = [];


      /*
      نمر على الدروس المطلوبة
      */

      for (
        const lessonId
        of lessonIds
      ) {

        if (
          selectedQuestions.length >=
          requestedCount
        ) {
          break;
        }


        /*
        عدد الأسئلة المتبقية
        */

        const remaining =
          requestedCount -
          selectedQuestions.length;


        /*
        ==============================
        اختيار الأسئلة
        ==============================
        */

        const result =
          await selectRandomQuestions({

            stageId,

            gradeId,

            subjectId:
              subject,

            unitId,

            lessonId,

            count:
              remaining,

            type,

            difficulty:
              difficulty === "any"
                ? undefined
                : difficulty,

            userId,

            avoidPreviousUsage,

            /*
            استبعاد ما تم اختياره
            من الدروس السابقة.
            */

            excludeQuestionIds:
              selectedQuestions.map(
                (q) =>
                  q._id
              ),
          });


        if (
          result.success &&
          result.questions.length
        ) {

          selectedQuestions.push(
            ...result.questions
          );
        }
      }


      /*
      ==============================
      التحقق من العدد
      ==============================
      */

      if (
        selectedQuestions.length <
        requestedCount
      ) {

        return res.status(400).json({

          success: false,

          error:
            "لا يوجد عدد كافٍ من الأسئلة غير المستخدمة لتكوين الامتحان.",

          requested:
            requestedCount,

          available:
            selectedQuestions.length,

          message:
            "يمكنك تقليل عدد الأسئلة أو إضافة دروس أخرى إلى الامتحان.",

        });
      }


      /*
      ==============================
      تحويل سؤال البنك
      إلى سؤال داخل الامتحان
      ==============================
      */

      const examQuestions =
        selectedQuestions.map(
          (question) => ({

            questionBankId:
              question._id,

            questionText:
              question.questionText,

            type:
              question.type,

            choices:
              question.type === "mcq"
                ? (
                    question.choices ||
                    []
                  ).map(
                    (choice) =>
                      choice.text
                  )
                : [],

            correctAnswer:
              question.correctAnswer,

            modelAnswer:
              question.modelAnswer ||
              "",

            marks:
              question.marks || 1,

            difficulty:
              question.difficulty ||
              "medium",

            source:
              "question-bank",

            lessonId:
              question.lessonId,

            explanation:
              question.explanation ||
              "",
          })
        );


      /*
      ==============================
      إنشاء الامتحان
      ==============================
      */

      const exam =
        new Exam({

          title:
            title.trim(),

          description,

          subject,

          stageId,

          gradeId,

          unitId,

          duration,

          withGifts,

          creationSource:
            "question-bank",

          questionBankSettings: {

            enabled: true,

            count:
              requestedCount,

            lessonIds,

            difficulty,

            avoidPreviousUsage,

          },

          questions:
            examQuestions,

          status,

          allowPrevious,

          strictMode,

        });


      await exam.save();


      /*
      ==============================
      النتيجة
      ==============================
      */

      res.status(201).json({

        success: true,

        message:
          "تم إنشاء الامتحان من بنك الأسئلة بنجاح.",

        exam,

        selectedCount:
          examQuestions.length,

      });

    } catch (err) {

      console.error(
        "Error creating exam from question bank:",
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
// DELETE — حذف امتحان
// ======================================================

router.delete("/:id", async (req, res) => {

  try {

    const deleted =
      await Exam.findByIdAndDelete(
        req.params.id
      );


    if (!deleted) {

      return res.status(404).json({
        success: false,
        message:
          "Exam not found",
      });
    }


    res.json({

      success: true,

      message:
        "Exam deleted successfully",

    });

  } catch (err) {

    console.error(
      "Error deleting exam:",
      err
    );

    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
});


module.exports = router;