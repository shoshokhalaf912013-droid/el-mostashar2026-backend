const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const JWT_SECRET = process.env.JWT_SECRET || "dev_secret";

// إنشاء توكين
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

// التحقق من التوكين بدون استخدامه كـ middleware
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

// تشفير الباسورد
async function hashPassword(plain) {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(plain, salt);
}

// مقارنة الباسورد مع نسخة مشفرة
async function comparePassword(plain, hash) {
  return await bcrypt.compare(plain, hash);
}

module.exports = {
  signToken,
  verifyToken,
  hashPassword,
  comparePassword,
};
