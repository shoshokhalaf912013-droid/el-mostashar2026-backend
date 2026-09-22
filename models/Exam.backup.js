// models/Exam.js

const mongoose = require("mongoose");

/*
========================================================
Exam
نظام الامتحانات

مصادر إنشاء الامتحان:

1. question-bank = من بنك الأسئلة
2. manual        = يدوي
3. ai            = ذكاء اصطناعي
4. file          = استيراد من ملف

بعد إنشاء الامتحان يتم حفظ الأسئلة الفعلية داخله.
لذلك تغيير بنك الأسئلة لاحقًا لا يغير امتحانًا تم إنشاؤه.
========================================================
*/


/* ======================================================
   Question داخل الامتحان
====================================================== */

const questionSchema = new mongoose.Schema(
  {
    /*
    ==============================
    رقم السؤال
    ==============================

    يبدأ دائمًا من 1 وليس من 0.
    */

    questionNumber: {
      type: Number,
      required: true,
      min: 1,
    },

    /*
    ==============================
    معرف سؤال بنك الأسئلة
    ==============================
    */

    questionBankId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "QuestionBank",
      default: null,
    },

    /*
    ==============================
    نص السؤال
    ==============================
    */

    questionText: {
      type: String,
      required: true,
      trim: true,
    },

    /*
    ==============================
    نوع السؤال
    ==============================

    mcq   = اختيار من متعدد
    essay = مقالي
    */

    type: {
      type: String,
      enum: ["mcq", "essay"],
      default: "mcq",
    },

    /*
    ==============================
    الاختيارات
    ==============================

    الترتيب:

    0 = أ
    1 = ب
    2 = ج
    3 = د
    */

    choices: {
      type: [String],
      default: [],
    },

    /*
    ==============================
    الإجابة الصحيحة
    ==============================

    0 = أ
    1 = ب
    2 = ج
    3 = د

    في السؤال المقالي تكون null.
    */

    correctAnswer: {
      type: Number,
      min: 0,
      max: 3,
      default: null,
    },

    /*
    ==============================
    نموذج الإجابة للمقالي
    ==============================
    */

    modelAnswer: {
      type: String,
      default: "",
    },

    /*
    ==============================
    الدرجة
    ==============================
    */

    marks: {
      type: Number,
      default: 1,
      min: 0,
    },

    /*
    ==============================
    مستوى الصعوبة
    ==============================
    */

    difficulty: {
      type: String,
      enum: ["easy", "medium", "hard"],
      default: "medium",
    },

    /*
    ==============================
    مصدر السؤال
    ==============================
    */

    source: {
      type: String,
      enum: [
        "question-bank",
        "manual",
        "ai",
        "file",
      ],
      default: "manual",
    },

    /*
    ==============================
    معرف الدرس
    ==============================
    */

    lessonId: {
      type: String,
      default: "",
    },

    /*
    ==============================
    شرح السؤال
    ==============================
    */

    explanation: {
      type: String,
      default: "",
    },
  },
  {
    _id: true,
  }
);


/* ======================================================
   Exam Schema
====================================================== */

const examSchema = new mongoose.Schema(
  {
    /*
    ==============================
    عنوان الامتحان
    ==============================
    */

    title: {
      type: String,
      required: true,
      trim: true,
    },

    /*
    ==============================
    وصف الامتحان
    ==============================
    */

    description: {
      type: String,
      default: "",
    },

    /*
    ==============================
    المادة
    ==============================
    */

    subject: {
      type: String,
      default: "",
    },

    /*
    ==============================
    المرحلة
    ==============================
    */

    stageId: {
      type: String,
      default: "",
      index: true,
    },

    /*
    ==============================
    الصف
    ==============================
    */

    gradeId: {
      type: String,
      default: "",
      index: true,
    },

    /*
    ==============================
    الوحدة
    ==============================
    */

    unitId: {
      type: String,
      default: "",
      index: true,
    },

    /*
    ==============================
    مدة الامتحان بالدقائق
    ==============================
    */

    duration: {
      type: Number,
      default: 30,
      min: 1,
    },

    /*
    ==============================
    عدد الأسئلة
    ==============================
    */

    questionsCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    /*
    ==============================
    مصدر إنشاء الامتحان
    ==============================
    */

    creationSource: {
      type: String,
      enum: [
        "question-bank",
        "manual",
        "ai",
        "file",
      ],
      default: "manual",
      index: true,
    },

    /*
    ==============================
    إعداد بنك الأسئلة
    ==============================
    */

    questionBankSettings: {
      enabled: {
        type: Boolean,
        default: false,
      },

      count: {
        type: Number,
        default: 0,
        min: 0,
      },

      lessonIds: {
        type: [String],
        default: [],
      },

      difficulty: {
        type: String,
        enum: [
          "any",
          "easy",
          "medium",
          "hard",
        ],
        default: "any",
      },

      avoidPreviousUsage: {
        type: Boolean,
        default: true,
      },
    },

    /*
    ==============================
    الذكاء الاصطناعي
    ==============================
    */

    aiSettings: {
      enabled: {
        type: Boolean,
        default: false,
      },

      prompt: {
        type: String,
        default: "",
      },

      reviewed: {
        type: Boolean,
        default: false,
      },
    },

    /*
    ==============================
    الملف المستورد
    ==============================
    */

    importedFile: {
      fileName: {
        type: String,
        default: "",
      },

      fileUrl: {
        type: String,
        default: "",
      },
    },

    /*
    ==============================
    الهدايا
    ==============================
    */

    withGifts: {
      type: Boolean,
      default: false,
    },

    /*
    ==============================
    الأسئلة الفعلية للامتحان
    ==============================
    */

    questions: {
      type: [questionSchema],
      default: [],
    },

    /*
    ==============================
    حالة الامتحان
    ==============================
    */

    status: {
      type: String,
      enum: [
        "draft",
        "published",
        "closed",
      ],
      default: "draft",
      index: true,
    },

    /*
    ==============================
    السماح بالرجوع
    ==============================
    */

    allowPrevious: {
      type: Boolean,
      default: true,
    },

    /*
    ==============================
    الوضع الصارم
    ==============================
    */

    strictMode: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);


/* ======================================================
   قبل الحفظ
====================================================== */

examSchema.pre("save", function () {
  /*
  تحديث عدد الأسئلة تلقائيًا
  */

  this.questionsCount = Array.isArray(this.questions)
    ? this.questions.length
    : 0;

  /*
  التأكد من أن ترقيم الأسئلة يبدأ من 1
  */

  if (Array.isArray(this.questions)) {
    this.questions.forEach((question, index) => {
      question.questionNumber = index + 1;
    });
  }
});


/* ======================================================
   Indexes
====================================================== */

examSchema.index({
  subject: 1,
  status: 1,
  createdAt: -1,
});

examSchema.index({
  creationSource: 1,
  createdAt: -1,
});


/* ======================================================
   EXPORT
====================================================== */

module.exports = mongoose.model(
  "Exam",
  examSchema
);