const admin = require("firebase-admin");

// ==============================
// إضافة درس جديد
// ==============================
exports.addLesson = async (req, res, next) => {
  try {
    const { title, description, teacherId, videoLink } = req.body;

    if (!title || !teacherId || !videoLink) {
      return res.status(400).json({
        error: "title, teacherId and videoLink are required",
      });
    }

    const lessonData = {
      title,
      description: description || "",
      teacherId,
      videoLink, // 💎 القاعدة الماسية
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    const docRef = await admin
      .firestore()
      .collection("lessons")
      .add(lessonData);

    res.status(201).json({
      id: docRef.id,
      ...lessonData,
    });
  } catch (err) {
    console.error("🔥 addLesson error:", err);
    next(err);
  }
};

// ==============================
// جلب دروس معلم معين
// ==============================
exports.getLessonsByTeacher = async (req, res, next) => {
  try {
    const { teacherId } = req.query;

    if (!teacherId) {
      return res.status(400).json({
        error: "teacherId is required",
      });
    }

    const snapshot = await admin
      .firestore()
      .collection("lessons")
      .where("teacherId", "==", teacherId)
      .get();

    const lessons = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(lessons);
  } catch (err) {
    console.error("🔥 getLessonsByTeacher error:", err);
    next(err);
  }
};

// ==============================
// جلب درس واحد بالـ id (للطلاب)
// ==============================
exports.getLessonById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const doc = await admin
      .firestore()
      .collection("lessons")
      .doc(id)
      .get();

    if (!doc.exists) {
      return res.status(404).json({
        error: "Lesson not found",
      });
    }

    res.json({
      id: doc.id,
      ...doc.data(),
    });
  } catch (err) {
    console.error("🔥 getLessonById error:", err);
    next(err);
  }
};
