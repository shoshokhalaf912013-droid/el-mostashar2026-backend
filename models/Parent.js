// =========================================================
// backend/models/Parent.js
// =========================================================

const mongoose = require("mongoose");

/*
=========================================================
Parent

حساب ولي الأمر.

ولي الأمر يمكن أن يرتبط بطفل واحد أو أكثر.

نحن لا نضع بيانات الطالب كاملة هنا.

نضع فقط:
- Parent UID
- Children UIDs
- الصلاحيات المسموح بها
=========================================================
*/


// =========================================================
// CHILD ACCESS SCHEMA
// =========================================================

const childAccessSchema =
  new mongoose.Schema(
    {
      /*
      ==============================
      UID الطالب
      ==============================
      */

      studentId: {
        type: String,
        required: true,
      },


      /*
      ==============================
      الاسم الظاهر
      ==============================
      */

      studentName: {
        type: String,
        default: "",
      },


      /*
      ==============================
      هل الرابط فعال؟
      ==============================
      */

      active: {
        type: Boolean,
        default: true,
      },


      /*
      ==============================
      تاريخ الربط
      ==============================
      */

      linkedAt: {
        type: Date,
        default: Date.now,
      },


      /*
      ==============================
      صلاحيات الطفل
      ==============================
      */

      permissions: {
        grades: {
          type: Boolean,
          default: true,
        },

        exams: {
          type: Boolean,
          default: true,
        },

        assignments: {
          type: Boolean,
          default: true,
        },

        attendance: {
          type: Boolean,
          default: true,
        },

        lessons: {
          type: Boolean,
          default: true,
        },

        progress: {
          type: Boolean,
          default: true,
        },

        alerts: {
          type: Boolean,
          default: true,
        },
      },
    },
    {
      _id: false,
    }
  );


// =========================================================
// PARENT SCHEMA
// =========================================================

const parentSchema =
  new mongoose.Schema(
    {
      /*
      ==============================
      Firebase UID لولي الأمر
      ==============================
      */

      userId: {
        type: String,
        required: true,
        unique: true,
        index: true,
      },


      /*
      ==============================
      الاسم
      ==============================
      */

      fullName: {
        type: String,
        default: "",
        trim: true,
      },


      /*
      ==============================
      البريد
      ==============================
      */

      email: {
        type: String,
        default: "",
        trim: true,
        lowercase: true,
      },


      /*
      ==============================
      رقم الهاتف
      ==============================
      */

      phone: {
        type: String,
        default: "",
        trim: true,
      },


      /*
      ==============================
      الأبناء
      ==============================
      */

      children: {
        type: [childAccessSchema],
        default: [],
      },


      /*
      ==============================
      حالة الحساب
      ==============================
      */

      active: {
        type: Boolean,
        default: true,
        index: true,
      },


      /*
      ==============================
      آخر دخول
      ==============================
      */

      lastLoginAt: {
        type: Date,
        default: null,
      },
    },
    {
      timestamps: true,
    }
  );


// =========================================================
// INDEXES
// =========================================================

parentSchema.index({
  "children.studentId": 1,
});

parentSchema.index({
  email: 1,
});


// =========================================================
// EXPORT
// =========================================================

module.exports =
  mongoose.model(
    "Parent",
    parentSchema
  );