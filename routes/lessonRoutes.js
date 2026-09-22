// backend/routes/lessonRoutes.js

const express = require("express");
const multer = require("multer");
const path = require("path");

const {
  addLesson,
  getLessonsByTeacher,
  getLessonById,
} = require("../controllers/lessonController");

const router = express.Router();


// ==============================
// Multer Upload Config
// ==============================

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/");
  },
  filename: function (req, file, cb) {
    const uniqueName =
      Date.now() + "-" + Math.round(Math.random() * 1e9);

    cb(null, uniqueName + path.extname(file.originalname));
  },
});

const upload = multer({ storage });


// ==============================
// LESSON ROUTES
// ==============================

// إضافة درس
router.post("/", addLesson);

// جلب دروس معلم
router.get("/", getLessonsByTeacher);

// جلب درس واحد
router.get("/:id", getLessonById);


// ==============================
// رفع PDF أو صورة للشرح
// ==============================

router.post("/upload", upload.single("file"), (req, res) => {

  if (!req.file) {
    return res.status(400).json({
      success: false,
      message: "No file uploaded",
    });
  }

  res.json({
    success: true,
    url: `/uploads/${req.file.filename}`,
  });

});

module.exports = router;