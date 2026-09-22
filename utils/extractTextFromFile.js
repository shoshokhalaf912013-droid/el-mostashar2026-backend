// backend/utils/extractTextFromFile.js
const path = require("path");

async function extractTextFromFile(file) {
  const ext = path.extname(file.originalname || "").toLowerCase();

  if (ext === ".txt") {
    return file.buffer.toString("utf8");
  }

  if (ext === ".docx") {
    const mammoth = require("mammoth");
    const result = await mammoth.extractRawText({ buffer: file.buffer });
    return result.value || "";
  }

  if (ext === ".pdf") {
    const pdfParseModule = require("pdf-parse");
    const pdfParse = pdfParseModule.default || pdfParseModule;
    const result = await pdfParse(file.buffer);
    return result.text || "";
  }

  throw new Error("نوع الملف غير مدعوم. استخدم PDF أو DOCX أو TXT.");
}

module.exports = { extractTextFromFile };
