// ==============================
//     AI QUESTION GENERATOR
// ==============================

require("dotenv").config();

const OpenAI = require("openai");

// ==============================
//       OPENAI CLIENT
// ==============================

if (!process.env.OPENAI_API_KEY) {
  console.warn(
    "⚠️ OPENAI_API_KEY is not defined in .env"
  );
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ==============================
//       BUILD PROMPT
// ==============================

function buildPrompt(text, options = {}) {
  const num =
    Math.min(
      Math.max(
        Number(options.numQuestions) || 10,
        1
      ),
      100
    );

  const difficulty =
    options.difficulty || "medium";

  const includeMcq =
    options.includeMcq !== false;

  const includeEssay =
    options.includeEssay !== false;

  const requestedTypes = [
    includeMcq
      ? "اختيار من متعدد (MCQ)"
      : null,
    includeEssay
      ? "سؤال مقالي"
      : null,
  ]
    .filter(Boolean)
    .join(" و ");

  return `
أنت خبير في إعداد الاختبارات التعليمية باللغة العربية.

اعتمد على النص المصدر فقط، ولا تضف معلومات غير موجودة في النص.

المطلوب:
إنشاء ${num} سؤالًا تعليميًا متنوعًا من محتوى النص.

أنواع الأسئلة المطلوبة:
${requestedTypes}

مستوى الصعوبة:
${difficulty}

قواعد مهمة:
1. يجب أن يكون كل سؤال مرتبطًا مباشرة بمحتوى النص.
2. لا تخترع حقائق أو معلومات من خارج النص.
3. اجعل الأسئلة متنوعة وغير مكررة.
4. إذا كان السؤال MCQ فيجب أن يحتوي على 4 اختيارات.
5. يجب تحديد رقم الاختيار الصحيح في correctAnswer من 0 إلى 3.
6. يجب كتابة سبب واضح لصحة الإجابة في correctReason.
7. يجب كتابة سبب خطأ كل اختيار خاطئ في wrongReasons، وعددها 3.
8. إذا كان السؤال مقاليًا، أنشئ:
   - essayType
   - modelAnswer
   - answerCriteria
   - marks
9. answerCriteria يجب أن تكون نقاطًا أساسية يمكن استخدامها في التصحيح لاحقًا.
10. لا تستخدم Markdown.
11. أخرج JSON فقط.
12. لا تكتب أي نص خارج JSON.
13. لا تقل إنك لا تعرف الإجابة؛ استخرج الإجابة من النص.
14. وزّع الأسئلة بين الأنواع المطلوبة قدر الإمكان.
15. لا تجعل جميع الأسئلة من أول جزء من النص فقط.

صيغة JSON المطلوبة بالضبط:

{
  "questions": [
    {
      "questionText": "نص السؤال",
      "type": "mcq",
      "choices": ["أ", "ب", "ج", "د"],
      "correctAnswer": 0,
      "correctReason": "سبب صحة الإجابة",
      "wrongReasons": [
        "سبب خطأ الاختيار الثاني",
        "سبب خطأ الاختيار الثالث",
        "سبب خطأ الاختيار الرابع"
      ],
      "marks": 1,
      "difficulty": "${difficulty}"
    },
    {
      "questionText": "نص السؤال المقالي",
      "type": "essay",
      "essayType": "explain",
      "modelAnswer": "الإجابة النموذجية",
      "answerCriteria": [
        "النقطة الأساسية الأولى",
        "النقطة الأساسية الثانية"
      ],
      "marks": 5,
      "difficulty": "${difficulty}"
    }
  ]
}

ملاحظة:
- لا تضع خصائص MCQ في السؤال المقالي.
- لا تضع خصائص المقال في MCQ.
- إذا كان عدد الأسئلة ${num}، أعد ${num} سؤالًا قدر الإمكان.
- استخدم اللغة العربية الواضحة المناسبة للمرحلة التعليمية.

النص المصدر:
--------------------
${String(text || "").slice(0, 120000)}
--------------------
`;
}

// ==============================
//    GENERATE QUESTIONS
// ==============================

async function generateQuestionsFromText(
  text,
  options = {}
) {
  if (!text || !String(text).trim()) {
    throw new Error("Text is required");
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY is not configured"
    );
  }

  const prompt = buildPrompt(
    text,
    options
  );

  try {
    const response =
      await openai.chat.completions.create({
        model:
          process.env.OPENAI_MODEL ||
          "gpt-4o-mini",

        messages: [
          {
            role: "system",
            content:
              "أنت مولد أسئلة تعليمية. أعد JSON فقط.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],

        max_tokens: 5000,
        temperature: 0.1,

        response_format: {
          type: "json_object",
        },
      });

    const raw =
      response.choices?.[0]?.message?.content?.trim();

    if (!raw) {
      throw new Error(
        "Empty response from OpenAI"
      );
    }

    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch (firstParseError) {
      const first = raw.indexOf("{");
      const last = raw.lastIndexOf("}");

      if (
        first === -1 ||
        last === -1 ||
        last <= first
      ) {
        throw new Error(
          "AI returned invalid JSON"
        );
      }

      parsed = JSON.parse(
        raw.slice(first, last + 1)
      );
    }

    const questions =
      Array.isArray(parsed?.questions)
        ? parsed.questions
        : Array.isArray(parsed)
        ? parsed
        : [];

    if (!questions.length) {
      throw new Error(
        "AI response does not contain a valid questions array"
      );
    }

    return questions;
  } catch (error) {
    console.error(
      "❌ OpenAI question generation error:",
      error
    );

    throw error;
  }
}

// ==============================
//          EXPORT
// ==============================

module.exports = {
  generateQuestionsFromText,
};
