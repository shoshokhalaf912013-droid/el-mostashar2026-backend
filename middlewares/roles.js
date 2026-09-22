module.exports.requireRole = (...roles) => {
  return (req, res, next) => {
    try {
      const userRole = req.user.role;

      if (!roles.includes(userRole)) {
        return res.status(403).json({ message: "Access Denied" });
      }

      next();
    } catch (err) {
      console.log(err);
      res.status(500).json({ message: "Server Error" });
    }
  };
};
