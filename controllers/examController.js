// controllers/examController.js
const Exam = require('../models/Exam');

// ➕ إضافة امتحان
exports.addExam = async (req, res, next) => {
  try {
    const exam = new Exam({
      title: req.body.title,
      description: req.body.description || "",
      duration: req.body.duration || 0,
      withGifts: req.body.withGifts || false,
      questions: req.body.questions || []
    });

    await exam.save();

    res.status(201).json({
      success: true,
      message: "Exam added successfully",
      exam
    });
  } catch (err) {
    console.error("❌ Error adding exam:", err);
    next(err);
  }
};


// 📌 عرض جميع الامتحانات
exports.getAllExams = async (req, res, next) => {
  try {
    const exams = await Exam.find()
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      success: true,
      exams
    });
  } catch (err) {
    console.error("❌ Error fetching exams:", err);
    next(err);
  }
};


// 🗑 حذف امتحان
exports.deleteExam = async (req, res, next) => {
  try {
    const deleted = await Exam.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: "Exam not found"
      });
    }

    res.json({
      success: true,
      message: "Exam deleted successfully"
    });
  } catch (err) {
    console.error("❌ Error deleting exam:", err);
    next(err);
  }
};
