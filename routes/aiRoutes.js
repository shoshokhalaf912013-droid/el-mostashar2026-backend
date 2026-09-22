// ==============================
//          AI ROUTES
// ==============================

const express = require("express");
const multer = require("multer");
const crypto = require("crypto");

// =====================================================
// PDF PARSER
// مهم: هذه هي طريقة pdf-parse الحديثة
// =====================================================

const {
  PDFParse,
} = require("pdf-parse");

const {
  generateQuestionsFromText,
} = require("../utils/generateQuestions.js");

const router = express.Router();

// =====================================================
// رفع الملفات
// =====================================================

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

// =====================================================
// تخزين مؤقت للملفات والعمليات
// =====================================================

const sourceFiles = new Map();

const jobs = new Map();

const MAX_SOURCE_CHARS = 120000;

// =====================================================
// إنشاء ID
// =====================================================

function makeId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

// =====================================================
// تنظيف النص
// =====================================================

function cleanText(text) {
  return String(text || "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n")
    .trim();
}

// =====================================================
// قراءة محتوى الملف
// PDF / DOCX / TXT
// =====================================================

async function extractTextFromUploadedFile(file) {

  if (!file || !file.buffer) {

    throw new Error(
      "لم يتم استلام أي ملف."
    );

  }

  const name =
    String(
      file.originalname || ""
    ).toLowerCase();

  const mime =
    String(
      file.mimetype || ""
    ).toLowerCase();


  // ===================================================
  // TXT
  // ===================================================

  if (
    name.endsWith(".txt") ||
    mime.includes("text/plain")
  ) {

    const text =
      file.buffer.toString("utf8");

    return cleanText(text);

  }


  // ===================================================
  // DOCX
  // ===================================================

  if (
    name.endsWith(".docx") ||
    mime.includes(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    )
  ) {

    const mammoth =
      require("mammoth");

    const result =
      await mammoth.extractRawText({
        buffer: file.buffer,
      });

    return cleanText(
      result.value
    );

  }


  // ===================================================
  // PDF
  // ===================================================

  if (
    name.endsWith(".pdf") ||
    mime === "application/pdf"
  ) {

    // -------------------------------------------------
    // مهم جدًا
    //
    // لا تستخدم:
    //
    // const pdfParse = require("pdf-parse");
    // const result = await pdfParse(file.buffer);
    //
    // لأن هذه الطريقة هي التي سببت:
    //
    // pdfParse is not a function
    //
    // الطريقة الصحيحة في الإصدار الحديث:
    // -------------------------------------------------

    const parser =
      new PDFParse({
        data: file.buffer,
      });

    try {

      const result =
        await parser.getText();

      return cleanText(
        result.text
      );

    } finally {

      await parser.destroy();

    }

  }


  // ===================================================
  // نوع ملف غير مدعوم
  // ===================================================

  throw new Error(
    "نوع الملف غير مدعوم. استخدم PDF أو DOCX أو TXT."
  );

}

// =====================================================
//       UPLOAD SOURCE FILE
// =====================================================

router.post(
  "/upload-source",

  upload.single("file"),

  async (req, res) => {

    try {

      // -------------------------------------------------
      // التأكد من وصول الملف
      // -------------------------------------------------

      if (!req.file) {

        return res.status(400).json({
          error:
            "لم يتم استلام أي ملف.",
        });

      }


      // -------------------------------------------------
      // استخراج النص من الملف
      // -------------------------------------------------

      const extractedText =
        await extractTextFromUploadedFile(
          req.file
        );


      // -------------------------------------------------
      // التأكد من وجود نص
      // -------------------------------------------------

      if (!extractedText) {

        return res.status(400).json({
          error:
            "تم رفع الملف، ولكن لم يتم العثور على نص قابل للقراءة بداخله.",
        });

      }


      // -------------------------------------------------
      // إنشاء File ID
      // -------------------------------------------------

      const fileId =
        makeId("src");


      // -------------------------------------------------
      // حفظ الملف في الذاكرة
      // -------------------------------------------------

      sourceFiles.set(
        fileId,
        {

          id: fileId,

          name:
            req.file.originalname,

          mimeType:
            req.file.mimetype,

          size:
            req.file.size,

          text:
            extractedText.slice(
              0,
              MAX_SOURCE_CHARS
            ),

          createdAt:
            Date.now(),

          gradeId:
            req.body.gradeId || "",

          subjectId:
            req.body.subjectId || "",

          unitId:
            req.body.unitId || "",

          lessonId:
            req.body.lessonId || "",

        }
      );


      // -------------------------------------------------
      // نجاح الرفع
      // -------------------------------------------------

      return res.json({

        success: true,

        fileId,

        fileName:
          req.file.originalname,

        textLength:
          extractedText.length,

      });

    }

    catch (err) {

      console.error(
        "❌ AI source upload error:",
        err
      );


      return res.status(500).json({

        error:
          err.message ||
          "فشل رفع وتحليل الملف.",

      });

    }

  }
);

// =====================================================
//       START AI GENERATION
// =====================================================

router.post(
  "/generate-questions",

  async (req, res) => {

    try {

      const {

        fileId,

        gradeId,

        subjectId,

        unitId,

        lessonId,

        questionCount,

        difficulty,

        includeMcq,

        includeEssay,

      } = req.body || {};


      // -------------------------------------------------
      // التأكد من وجود File ID
      // -------------------------------------------------

      if (!fileId) {

        return res.status(400).json({

          error:
            "fileId is required",

        });

      }


      // -------------------------------------------------
      // البحث عن الملف
      // -------------------------------------------------

      const source =
        sourceFiles.get(
          fileId
        );


      if (!source) {

        return res.status(404).json({

          error:
            "الملف غير موجود أو انتهت جلسة الرفع. ارفع الملف مرة أخرى.",

        });

      }


      // -------------------------------------------------
      // يجب اختيار نوع سؤال واحد على الأقل
      // -------------------------------------------------

      if (
        !includeMcq &&
        !includeEssay
      ) {

        return res.status(400).json({

          error:
            "اختر نوعًا واحدًا من الأسئلة على الأقل.",

        });

      }


      // -------------------------------------------------
      // عدد الأسئلة
      // -------------------------------------------------

      const count =
        Math.min(
          Math.max(
            Number(
              questionCount
            ) || 10,
            1
          ),
          100
        );


      // -------------------------------------------------
      // إنشاء Job ID
      // -------------------------------------------------

      const jobId =
        makeId("job");


      // -------------------------------------------------
      // إنشاء العملية
      // -------------------------------------------------

      jobs.set(
        jobId,
        {

          id:
            jobId,

          status:
            "processing",

          progress:
            5,

          stage:
            "queued",

          stageLabel:
            "تم استلام الطلب وبدء تجهيز المحتوى.",

          questions:
            [],

          error:
            null,

          createdAt:
            Date.now(),

          fileId,

        }
      );


      // -------------------------------------------------
      // نرسل Job ID فورًا للواجهة
      // -------------------------------------------------

      res.status(202).json({

        success:
          true,

        jobId,

      });


      // =================================================
      // معالجة التوليد في الخلفية
      // =================================================

      (async () => {

        const job =
          jobs.get(
            jobId
          );


        if (!job) {

          return;

        }


        try {

          // ---------------------------------------------
          // 15%
          // ---------------------------------------------

          job.progress =
            15;

          job.stage =
            "reading";

          job.stageLabel =
            "قراءة واستخراج محتوى الملف...";


          await new Promise(
            (resolve) =>
              setTimeout(
                resolve,
                150
              )
          );


          // ---------------------------------------------
          // 35%
          // ---------------------------------------------

          job.progress =
            35;

          job.stage =
            "analyzing";

          job.stageLabel =
            "تحليل المادة والمعلومات المهمة...";


          await new Promise(
            (resolve) =>
              setTimeout(
                resolve,
                150
              )
          );


          // ---------------------------------------------
          // 55%
          // ---------------------------------------------

          job.progress =
            55;

          job.stage =
            "generating";

          job.stageLabel =
            "إنشاء الأسئلة من محتوى الملف...";


          // ---------------------------------------------
          // استدعاء الذكاء الاصطناعي
          // ---------------------------------------------

          const questions =
            await generateQuestionsFromText(

              source.text,

              {

                numQuestions:
                  count,

                difficulty:
                  difficulty ||
                  "medium",

                includeMcq:
                  Boolean(
                    includeMcq
                  ),

                includeEssay:
                  Boolean(
                    includeEssay
                  ),

                gradeId:
                  gradeId ||
                  "",

                subjectId:
                  subjectId ||
                  "",

                unitId:
                  unitId ||
                  "",

                lessonId:
                  lessonId ||
                  "",

              }

            );


          // ---------------------------------------------
          // 88%
          // ---------------------------------------------

          job.progress =
            88;

          job.stage =
            "preparing_answers";

          job.stageLabel =
            "تجهيز الإجابات النموذجية ومعايير التصحيح...";


          await new Promise(
            (resolve) =>
              setTimeout(
                resolve,
                150
              )
          );


          // ---------------------------------------------
          // حفظ الأسئلة
          // ---------------------------------------------

          job.questions =
            Array.isArray(
              questions
            )
              ? questions
              : [];


          // ---------------------------------------------
          // التأكد من وجود أسئلة
          // ---------------------------------------------

          if (
            !job.questions.length
          ) {

            throw new Error(
              "لم يتم إنشاء أسئلة صالحة من محتوى الملف."
            );

          }


          // ---------------------------------------------
          // 100%
          // ---------------------------------------------

          job.progress =
            100;

          job.stage =
            "completed";

          job.stageLabel =
            "اكتمل تحليل الملف وتوليد الأسئلة وتجهيز الإجابات.";

          job.status =
            "completed";

        }

        catch (err) {

          console.error(
            "❌ AI generation job error:",
            err
          );


          job.status =
            "error";

          job.stage =
            "error";

          job.progress =
            0;

          job.error =
            err.message ||
            "حدث خطأ أثناء توليد الأسئلة.";

          job.stageLabel =
            job.error;

        }

      })();

    }

    catch (err) {

      console.error(
        "❌ AI generation start error:",
        err
      );


      return res.status(500).json({

        error:
          err.message ||
          "حدث خطأ أثناء بدء التوليد.",

      });

    }

  }
);

// =====================================================
//        GET JOB STATUS
// =====================================================

router.get(
  "/generate-questions/:jobId",

  (req, res) => {

    const job =
      jobs.get(
        req.params.jobId
      );


    if (!job) {

      return res.status(404).json({

        error:
          "عملية التوليد غير موجودة.",

      });

    }


    return res.json({

      jobId:
        job.id,

      status:
        job.status,

      progress:
        job.progress,

      stage:
        job.stage,

      stageLabel:
        job.stageLabel,

      questions:
        job.status ===
        "completed"
          ? job.questions
          : undefined,

      error:
        job.error,

    });

  }
);

// =====================================================
//             EXPORT
// =====================================================

module.exports =
  router;