// إذا تريد إيميل معين يكون سوبر أدمن دائمًا
const SUPER_ADMINS = [
  "khalafmahrous2000@gmail.com"
];

module.exports = function checkSuperAdmin(req, res, next) {
  try {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    if (SUPER_ADMINS.includes(user.email)) {
      req.user.role = "superAdmin"; // إجبارياً يكون سوبر أدمن
      return next();
    }

    next();
  } catch (err) {
    console.log("SuperAdmin check error", err);
    res.status(500).json({ message: "Server error" });
  }
};
