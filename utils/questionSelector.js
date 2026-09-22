// utils/questionSelector.js

const mongoose = require("mongoose");

const QuestionBank = require("../models/QuestionBank");
const QuestionUsage = require("../models/QuestionUsage");

/*
========================================================
Question Selector
محرك اختيار الأسئلة من بنك الأسئلة
========================================================

المهام:

1. اختيار عدد محدد من الأسئلة.
2. الاختيار العشوائي.
3. التصنيف حسب الدرس.
4. إمكانية تحديد نوع السؤال.
5. إمكانية تحديد مستوى الصعوبة.
6. استبعاد الأسئلة التي استخدمها الطالب سابقًا.
7. استبعاد الأسئلة المستبعدة يدويًا.
8. منع تكرار السؤال داخل الامتحان نفسه.
========================================================
*/


/*
========================================================
normalizeId
========================================================
*/

function normalizeId(id) {
  if (!id) return null;

  if (
    mongoose.Types.ObjectId.isValid(id)
  ) {
    return new mongoose.Types.ObjectId(id);
  }

  return null;
}


/*
========================================================
getPreviouslyUsedQuestionIds
========================================================

إرجاع IDs الأسئلة التي سبق للطالب استخدامها.

إذا لم يوجد userId:
لا يوجد استبعاد خاص بالطالب.
========================================================
*/

async function getPreviouslyUsedQuestionIds(userId) {

  if (!userId) {
    return [];
  }

  const usages =
    await QuestionUsage.find(
      {
        userId,
      },
      {
        questionId: 1,
        _id: 0,
      }
    ).lean();

  return usages
    .map(
      (item) => item.questionId
    )
    .filter(Boolean);
}


/*
========================================================
buildQuestionFilter
========================================================
*/

function buildQuestionFilter(options) {

  const {
    stageId,
    gradeId,
    subjectId,
    unitId,
    lessonId,
    type,
    difficulty,
    excludeQuestionIds = [],
  } = options;

  const filter = {
    active: true,
  };


  /*
  ==============================
  التصنيف التعليمي
  ==============================
  */

  if (stageId) {
    filter.stageId = stageId;
  }

  if (gradeId) {
    filter.gradeId = gradeId;
  }

  if (subjectId) {
    filter.subjectId = subjectId;
  }

  if (unitId) {
    filter.unitId = unitId;
  }

  if (lessonId) {
    filter.lessonId = lessonId;
  }


  /*
  ==============================
  نوع السؤال
  ==============================
  */

  if (type) {
    filter.type = type;
  }


  /*
  ==============================
  مستوى الصعوبة
  ==============================
  */

  if (difficulty) {
    filter.difficulty =
      difficulty;
  }


  /*
  ==============================
  استبعاد الأسئلة
  ==============================
  */

  if (
    Array.isArray(
      excludeQuestionIds
    ) &&
    excludeQuestionIds.length > 0
  ) {

    const validIds =
      excludeQuestionIds
        .map(normalizeId)
        .filter(Boolean);

    if (validIds.length > 0) {
      filter._id = {
        $nin: validIds,
      };
    }
  }


  return filter;
}


/*
========================================================
selectRandomQuestions
========================================================

الاستخدام:

const result =
  await selectRandomQuestions({
    lessonId: "...",
    userId: "...",
    count: 30
  });

========================================================
*/

async function selectRandomQuestions(
  options = {}
) {

  const {
    count = 10,
    userId = null,

    stageId,
    gradeId,
    subjectId,
    unitId,
    lessonId,

    type,
    difficulty,

    excludeQuestionIds = [],

    avoidPreviousUsage = true,
  } = options;


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
  يجب تحديد درس
  ==============================
  */

  if (!lessonId) {
    throw new Error(
      "lessonId مطلوب لاختيار الأسئلة من بنك الدرس."
    );
  }


  /*
  ==============================
  الأسئلة المستخدمة سابقًا
  ==============================
  */

  let previousQuestionIds = [];


  if (
    avoidPreviousUsage &&
    userId
  ) {

    previousQuestionIds =
      await getPreviouslyUsedQuestionIds(
        userId
      );
  }


  /*
  ==============================
  دمج جميع الاستبعادات
  ==============================
  */

  const allExcludedIds = [
    ...excludeQuestionIds,
    ...previousQuestionIds.map(
      (id) => id.toString()
    ),
  ];


  /*
  ==============================
  بناء الفلتر
  ==============================
  */

  const filter =
    buildQuestionFilter({
      stageId,
      gradeId,
      subjectId,
      unitId,
      lessonId,
      type,
      difficulty,

      excludeQuestionIds:
        allExcludedIds,
    });


  /*
  ==============================
  معرفة عدد الأسئلة المتاحة
  ==============================
  */

  const availableCount =
    await QuestionBank.countDocuments(
      filter
    );


  /*
  ==============================
  لا يوجد عدد كافٍ
  ==============================
  */

  if (
    availableCount <
    requestedCount
  ) {

    return {
      success: false,

      reason:
        "not_enough_questions",

      requested:
        requestedCount,

      available:
        availableCount,

      questions: [],
    };
  }


  /*
  ==============================
  RANDOM SAMPLE
  ==============================
  */

  const questions =
    await QuestionBank.aggregate([
      {
        $match: filter,
      },

      {
        $sample: {
          size: requestedCount,
        },
      },
    ]);


  /*
  ==============================
  النتيجة
  ==============================
  */

  return {
    success: true,

    requested:
      requestedCount,

    available:
      availableCount,

    questions,
  };
}


/*
========================================================
markQuestionsAsUsed
========================================================

تسجيل الأسئلة بعد إنشاء/بدء الامتحان.

مهم:
لا نسجل الاستخدام بمجرد "اقتراح" الأسئلة.

نسجله عندما تصبح الأسئلة جزءًا فعليًا
من محاولة الامتحان.
========================================================
*/

async function markQuestionsAsUsed({
  questions,
  userId,
  examId = null,
  attemptId = null,
  usageType = "exam",
}) {

  if (
    !userId ||
    !Array.isArray(questions) ||
    questions.length === 0
  ) {
    return {
      success: false,
      created: 0,
    };
  }


  /*
  ==============================
  تجهيز IDs
  ==============================
  */

  const questionIds =
    questions
      .map(
        (question) =>
          question._id ||
          question.questionId
      )
      .filter(Boolean);


  if (
    questionIds.length === 0
  ) {
    return {
      success: false,
      created: 0,
    };
  }


  /*
  ==============================
  منع التكرار داخل العملية نفسها
  ==============================
  */

  const uniqueQuestionIds =
    [
      ...new Set(
        questionIds.map(
          (id) => id.toString()
        )
      ),
    ];


  /*
  ==============================
  تجهيز السجلات
  ==============================
  */

  const documents =
    uniqueQuestionIds.map(
      (questionId) => ({
        questionId:
          new mongoose.Types.ObjectId(
            questionId
          ),

        userId,

        examId:
          normalizeId(examId),

        attemptId:
          normalizeId(attemptId),

        usageType,

        usedAt:
          new Date(),
      })
    );


  /*
  ==============================
  الإدخال
  ==============================
  */

  let created = 0;

  try {

    const result =
      await QuestionUsage.insertMany(
        documents,
        {
          ordered: false,
        }
      );

    created =
      result.length;

  } catch (error) {

    /*
    في حالة وجود سجل مكرر،
    MongoDB قد يعطي BulkWriteError.

    لا نريد إسقاط العملية كلها.
    */

    if (
      error &&
      error.writeErrors
    ) {

      created =
        documents.length -
        error.writeErrors.length;

    } else {

      throw error;
    }
  }


  /*
  ==============================
  تحديث إحصائيات بنك الأسئلة
  ==============================
  */

  await QuestionBank.updateMany(
    {
      _id: {
        $in:
          uniqueQuestionIds.map(
            normalizeId
          ),
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


  return {
    success: true,
    created,
    total:
      uniqueQuestionIds.length,
  };
}


/*
========================================================
EXPORT
========================================================
*/

module.exports = {
  selectRandomQuestions,
  markQuestionsAsUsed,
  getPreviouslyUsedQuestionIds,
};