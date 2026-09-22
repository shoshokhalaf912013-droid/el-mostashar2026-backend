// routes/studentExamRoutes.js
const express = require("express");
const router = express.Router();
const Exam = require("../models/Exam");
const Attempt = require("../models/Attempt");
const Gift = require("../models/Gift");
const auth = require("../middlewares/auth");


// بدء الامتحان
router.get("/start/:id", auth, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);

    if (!exam) return res.status(404).json({ msg: "Exam not found" });

    res.json({
      success: true,
      exam: {
        title: exam.title,
        duration: exam.duration,
        questionsCount: exam.questions.length
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
});

// الحصول على الامتحان و الأسئلة
router.get("/take/:id", auth, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);

    if (!exam) return res.status(404).json({ msg: "Exam not found" });

    res.json({
      success: true,
      exam: {
        title: exam.title,
        duration: exam.duration,
        questions: exam.questions
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
});

// إرسال الإجابات
router.post("/submit/:id", auth, async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id);
    if (!exam) return res.status(404).json({ msg: "Exam not found" });

    let score = 0;

    exam.questions.forEach((q) => {
      const studentAnswer = req.body.answers[q._id];
      if (studentAnswer === q.correctAnswer) score++;
    });

    const attempt = new Attempt({
      studentId: req.user.id,
      examId: exam._id,
      score,
      total: exam.questions.length
    });

    await attempt.save();

    // توزيع الهدايا إن وجد
    if (exam.withGifts && score === exam.questions.length) {
      const gift = new Gift({
        studentId: req.user.id,
        examId: exam._id,
        type: "gold",
        amount: 1
      });
      await gift.save();
    }

    res.json({
      success: true,
      score,
      total: exam.questions.length,
      gifted: exam.withGifts && score === exam.questions.length
    });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
});

// نتيجة الطالب
router.get("/result/:id", auth, async (req, res) => {
  try {
    const attempt = await Attempt.findOne({
      studentId: req.user.id,
      examId: req.params.id
    });

    if (!attempt) return res.json({ success: false, msg: "No attempt found" });

    res.json({ success: true, attempt });
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message });
  }
});

module.exports = router;
