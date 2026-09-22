// backend/middlewares/rateLimiter.js
const rateLimit = require("express-rate-limit");

// ❗ RateLimiter لتسجيل الدخول فقط
const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 دقيقة
  max: 5, // 5 محاولات فقط
  message: {
    success: false,
    error: "Too many login attempts. Please try again after 1 minute."
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ❗ RateLimiter خفيف لبقية الـ API
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120, // مناسب جداً للـ React
  message: {
    success: false,
    error: "Too many requests, slow down!"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { loginLimiter, apiLimiter };
