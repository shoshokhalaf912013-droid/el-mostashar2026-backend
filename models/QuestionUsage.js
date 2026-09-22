// models/QuestionUsage.js

const mongoose = require("mongoose");

/*
========================================================
Question Usage
سجل استخدام السؤال
========================================================

هذا السجل يحدد:
- أي سؤال تم استخدامه
- مع أي طالب
- في أي امتحان
- في أي محاولة
- ومتى تم استخدامه

وبذلك نستطيع منع تكرار السؤال للطالب.
========================================================
*/

const questionUsageSchema = new mongoose.Schema(
  {
    /* =========================
       السؤال
    ========================= */

    questionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QuestionBank",
      required: true,
      index: true,
    },

    /* =========================
       الطالب
    ========================= */

    userId: {
      type: String,
      required: true,
      index: true,
    },

    /* =========================
       الامتحان
    ========================= */

    examId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Exam",
      default: null,
      index: true,
    },

    /* =========================
       محاولة الامتحان
    ========================= */

    attemptId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attempt",
      default: null,
      index: true,
    },

    /* =========================
       نوع الاستخدام
    =========================

    exam      = استخدم في امتحان
    preview   = معاينة
    practice  = تدريب
    */

    usageType: {
      type: String,
      enum: [
        "exam",
        "preview",
        "practice",
      ],
      default: "exam",
      index: true,
    },

    /* =========================
       تاريخ الاستخدام
    ========================= */

    usedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

/*
========================================================
Indexes
========================================================
*/

/*
السؤال لا يتكرر لنفس الطالب
في نفس المحاولة.
*/

questionUsageSchema.index(
  {
    questionId: 1,
    userId: 1,
    attemptId: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      attemptId: {
        $type: "objectId",
      },
    },
  }
);

/*
تسريع البحث عن كل الأسئلة
التي سبق للطالب استخدامها.
*/

questionUsageSchema.index({
  userId: 1,
  questionId: 1,
  usedAt: -1,
});

/*
البحث حسب الطالب والامتحان.
*/

questionUsageSchema.index({
  userId: 1,
  examId: 1,
  usedAt: -1,
});

/*
========================================================
EXPORT
========================================================
*/

module.exports = mongoose.model(
  "QuestionUsage",
  questionUsageSchema
);