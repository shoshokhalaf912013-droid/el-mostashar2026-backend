const mongoose = require("mongoose");

/*
========================================================
Question Bank
بنك الأسئلة مستقل تمامًا عن الامتحانات
========================================================
*/

/* =========================
   الاختيار من متعدد
========================= */

const choiceSchema = new mongoose.Schema(
  {
    label: {
      type: String,
      enum: ["أ", "ب", "ج", "د"],
      required: true,
    },

    text: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

/* =========================
   معايير تصحيح السؤال المقالي
========================= */

const gradingCriterionSchema = new mongoose.Schema(
  {
    criterion: {
      type: String,
      required: true,
      trim: true,
    },

    marks: {
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { _id: false }
);

/* =========================
   السؤال
========================= */

const questionBankSchema = new mongoose.Schema(
  {
    /* =====================
       نص السؤال
    ===================== */

    questionText: {
      type: String,
      required: true,
      trim: true,
    },

    /* =====================
       نوع السؤال
       mcq   = اختيار من متعدد
       essay = مقالي
    ===================== */

    type: {
      type: String,
      enum: ["mcq", "essay"],
      required: true,
      default: "mcq",
    },

    /* =====================
       الاختيارات
       تستخدم فقط مع MCQ
    ===================== */

    choices: {
      type: [choiceSchema],
      default: [],
    },

    /* =====================
       الإجابة الصحيحة
       0 = أ
       1 = ب
       2 = ج
       3 = د
    ===================== */

    correctAnswer: {
      type: Number,
      min: 0,
      max: 3,
      default: null,
    },

    /* =====================
       نموذج الإجابة للمقالي
    ===================== */

    modelAnswer: {
      type: String,
      default: "",
      trim: true,
    },

    /* =====================
       معايير التصحيح للمقالي
    ===================== */

    gradingCriteria: {
      type: [gradingCriterionSchema],
      default: [],
    },

    /* =====================
       الدرجة
    ===================== */

    marks: {
      type: Number,
      default: 1,
      min: 0,
    },

    /* =====================
       التصنيف التعليمي
    ===================== */

    stageId: {
      type: String,
      default: "",
      index: true,
    },

    gradeId: {
      type: String,
      default: "",
      index: true,
    },

    subjectId: {
      type: String,
      default: "",
      index: true,
    },

    unitId: {
      type: String,
      default: "",
      index: true,
    },

    lessonId: {
      type: String,
      default: "",
      index: true,
    },

    /* =====================
       مستوى الصعوبة
    ===================== */

    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },

    /* =====================
       مصدر السؤال
    ===================== */

    source: {
      type: String,
      enum: [
        "teacher",
        "ai",
        "file",
        "mixed",
        "other",
      ],
      default: "teacher",
    },

    /* =====================
       اسم / وصف المصدر
    ===================== */

    sourceName: {
      type: String,
      default: "",
      trim: true,
    },

    /* =====================
       شرح إضافي
    ===================== */

    explanation: {
      type: String,
      default: "",
      trim: true,
    },

    /* =====================
       بيانات الذكاء الاصطناعي
    ===================== */

    aiGenerated: {
      type: Boolean,
      default: false,
    },

    aiReviewed: {
      type: Boolean,
      default: false,
    },

    /* =====================
       منع تكرار السؤال
    ===================== */

    normalizedText: {
      type: String,
      default: "",
      index: true,
    },

    /* =====================
       إحصائيات الاستخدام
    ===================== */

    usageCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastUsedAt: {
      type: Date,
      default: null,
    },

    /* =====================
       الحالة
    ===================== */

    active: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

/*
========================================================
تطبيع نص السؤال
يساعد في منع إدخال السؤال نفسه أكثر من مرة
========================================================
*/

questionBankSchema.pre("save", function () {
  if (this.questionText) {
    this.normalizedText = this.questionText
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  }
});

/*
========================================================
Validation
========================================================
*/

questionBankSchema.pre("validate", function () {
  /* =========================
     MCQ
  ========================= */

  if (this.type === "mcq") {
    if (
      !this.choices ||
      this.choices.length !== 4
    ) {
      throw new Error(
        "سؤال الاختيار من متعدد يجب أن يحتوي على 4 اختيارات."
      );
    }

    if (
      this.correctAnswer === null ||
      this.correctAnswer === undefined
    ) {
      throw new Error(
        "يجب تحديد الإجابة الصحيحة لسؤال الاختيار من متعدد."
      );
    }

    if (
      this.correctAnswer < 0 ||
      this.correctAnswer > 3
    ) {
      throw new Error(
        "الإجابة الصحيحة يجب أن تكون بين 0 و3."
      );
    }

    /*
    لا نحتاج نموذج إجابة
    أو معايير تصحيح للمقالي
    */

    this.modelAnswer = "";
    this.gradingCriteria = [];
  }

  /* =========================
     ESSAY
  ========================= */

  if (this.type === "essay") {
    this.choices = [];
    this.correctAnswer = null;
  }
});

/*
========================================================
Indexes
========================================================

البنك مصنف أساسًا حسب الدرس.
========================================================
*/

questionBankSchema.index({
  stageId: 1,
  gradeId: 1,
  subjectId: 1,
  unitId: 1,
  lessonId: 1,
  active: 1,
});

questionBankSchema.index({
  lessonId: 1,
  type: 1,
  active: 1,
});

questionBankSchema.index({
  lessonId: 1,
  difficulty: 1,
  active: 1,
});

/*
========================================================
منع التكرار داخل نفس الدرس
========================================================

السؤال نفسه لا يتكرر في نفس الدرس طالما أنه active.
========================================================
*/

questionBankSchema.index(
  {
    lessonId: 1,
    normalizedText: 1,
  },
  {
    unique: true,
    partialFilterExpression: {
      active: true,
    },
  }
);

/*
========================================================
EXPORT
========================================================
*/

module.exports = mongoose.model(
  "QuestionBank",
  questionBankSchema
);