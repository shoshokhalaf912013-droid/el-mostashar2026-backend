// routes/attemptRoutes.js

const express = require("express");
const router = express.Router();

const attemptController = require("../controllers/attemptController");

/*
========================================================
START ATTEMPT
بدء محاولة امتحان
========================================================
*/

router.post(
  "/start",
  attemptController.startAttempt
);

/*
========================================================
GET ATTEMPT
جلب بيانات محاولة الطالب
========================================================
*/

router.get(
  "/:id",
  attemptController.getAttempt
);

/*
========================================================
SAVE ATTEMPT
حفظ إجابات الطالب
========================================================
*/

router.post(
  "/:id/save",
  attemptController.saveAttempt
);

/*
========================================================
PING ATTEMPT
Heartbeat للمحاولة
========================================================
*/

router.post(
  "/:id/ping",
  attemptController.pingAttempt
);

/*
========================================================
LEAVE ATTEMPT
مغادرة الامتحان
========================================================
*/

router.post(
  "/:id/leave",
  attemptController.leaveAttempt
);

/*
========================================================
SUBMIT ATTEMPT
تسليم الامتحان
========================================================
*/

router.post(
  "/:id/submit",
  attemptController.submitAttempt
);

/*
========================================================
TEACHER — ESSAY ATTEMPTS
جلب محاولات الطلاب التي تحتوي على أسئلة مقالية

GET:
 /api/attempts/exam/:examId/essay-attempts

يستخدمه المدرس لعرض:
- الطلاب
- أسئلة المقال
- إجابات الطلاب
- صور الحل
- الدرجات السابقة
- تعليقات المدرس
========================================================
*/

router.get(
  "/exam/:examId/essay-attempts",
  attemptController.getEssayAttempts
);

/*
========================================================
TEACHER — GRADE ESSAY
تصحيح سؤال مقالي

POST:
 /api/attempts/:id/grade-essay

Body:

{
  questionIndex: 0,
  awardedMarks: 4,
  teacherComment: "إجابة جيدة"
}

يقوم الـController بالتحقق من:
- صلاحية المدرس
- وجود المحاولة
- أن المحاولة Submitted
- وجود الامتحان
- أن السؤال Essay
- أن الدرجة لا تتجاوز الدرجة القصوى
- إعادة حساب النتيجة
========================================================
*/

router.post(
  "/:id/grade-essay",
  attemptController.gradeEssay
);

module.exports = router;