const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

/*
============================================================
 El-Mostashar
 Add Public Lesson IDs
============================================================

IMPORTANT:
- Reads from: lessons/{lessonId}
- Adds ONLY: publicLessonId
- Does NOT modify:
    videoUrl
    videoLink
    videoType
    video
    flow
    pdfUrl
    description
    title
    gradeId
    subjectId
    unitId
    or any other field.

Default mode = DRY RUN.
Use --apply only after reviewing the result.
============================================================
*/

const serviceAccountPath = path.resolve(
  __dirname,
  "keys",
  "serviceAccountKey.json"
);

if (!fs.existsSync(serviceAccountPath)) {
  console.error("");
  console.error("❌ serviceAccountKey.json not found.");
  console.error("");
  console.error("Expected:");
  console.error(serviceAccountPath);
  console.error("");
  process.exit(1);
}

let serviceAccount;

try {
  serviceAccount = require(serviceAccountPath);
} catch (error) {
  console.error("");
  console.error("❌ Could not read serviceAccountKey.json.");
  console.error("");
  console.error(error.message);
  console.error("");
  process.exit(1);
}

/*
============================================================
 Firebase
============================================================
*/

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

 const { getFirestore } = require("firebase-admin/firestore");

const db = getFirestore(
  admin.app(),
  "el-mostashar2026"
);

const APPLY_MODE =
  process.argv.includes("--apply");

/*
============================================================
 Public ID generator
============================================================
*/

const usedIds = new Set();

function generatePublicLessonId() {
  /*
   * Avoid ambiguous characters:
   * 0 / O / I / l / 1
   */

  const characters =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

  let id = "";

  do {
    id = "";

    for (let i = 0; i < 12; i++) {
      const randomIndex =
        Math.floor(
          Math.random() * characters.length
        );

      id += characters[randomIndex];
    }
  } while (usedIds.has(id));

  usedIds.add(id);

  return id;
}

/*
============================================================
 Main
============================================================
*/

async function main() {
  console.log("");
  console.log(
    "============================================================"
  );
  console.log(
    " El-Mostashar - Add Public Lesson IDs"
  );
  console.log(
    "============================================================"
  );

  console.log(
    "Firestore collection: lessons"
  );

  console.log(
    APPLY_MODE
      ? "⚠️ MODE: APPLY - Firestore WILL be changed"
      : "🔎 MODE: DRY RUN - Firestore will NOT be changed"
  );

  console.log(
    "============================================================"
  );

  console.log("");

  /*
  ============================================================
   Read all lessons
  ============================================================
  */

  const lessonsSnapshot =
    await db
      .collection("lessons")
      .get();

  console.log(
    `Found ${lessonsSnapshot.size} lesson document(s).`
  );

  console.log("");

  /*
  ============================================================
   First collect all existing public IDs
  ============================================================
  */

  lessonsSnapshot.docs.forEach(
    (lessonDoc) => {
      const data =
        lessonDoc.data() || {};

      if (
        typeof data.publicLessonId === "string" &&
        data.publicLessonId.trim()
      ) {
        usedIds.add(
          data.publicLessonId.trim()
        );
      }
    }
  );

  /*
  ============================================================
   Statistics
  ============================================================
  */

  let existingCount = 0;

  let missingCount = 0;

  let operations = [];

  /*
  ============================================================
   Inspect lessons
  ============================================================
  */

  for (
    const lessonDoc
    of lessonsSnapshot.docs
  ) {
    const lessonId =
      lessonDoc.id;

    const data =
      lessonDoc.data() || {};

    const title =
      data.title ||
      "(بدون عنوان)";

    const gradeId =
      data.gradeId ||
      "(بدون gradeId)";

    const subjectId =
      data.subjectId ||
      "(بدون subjectId)";

    const unitId =
      data.unitId ||
      "(بدون unitId)";

    console.log(
      "------------------------------------------------------------"
    );

    console.log(
      `Lesson: ${title}`
    );

    console.log(
      `Lesson ID: ${lessonId}`
    );

    console.log(
      `Grade: ${gradeId}`
    );

    console.log(
      `Subject: ${subjectId}`
    );

    console.log(
      `Unit: ${unitId}`
    );

    /*
    ==========================================================
     Existing publicLessonId
    ==========================================================
    */

    if (
      typeof data.publicLessonId === "string" &&
      data.publicLessonId.trim()
    ) {
      existingCount++;

      console.log(
        `✅ Existing publicLessonId: ${data.publicLessonId.trim()}`
      );

      continue;
    }

    /*
    ==========================================================
     Generate new publicLessonId
    ==========================================================
    */

    const publicLessonId =
      generatePublicLessonId();

    missingCount++;

    console.log(
      `🆕 New publicLessonId: ${publicLessonId}`
    );

    /*
    ==========================================================
     IMPORTANT:
     Only this ONE field will be added.
    ==========================================================
    */

    operations.push({
      ref: lessonDoc.ref,

      data: {
        publicLessonId,
      },
    });
  }

  /*
  ============================================================
   Summary
  ============================================================
  */

  console.log("");

  console.log(
    "============================================================"
  );

  console.log(
    " Migration Summary"
  );

  console.log(
    "============================================================"
  );

  console.log(
    `Total lessons:          ${lessonsSnapshot.size}`
  );

  console.log(
    `Already have public ID: ${existingCount}`
  );

  console.log(
    `Missing public ID:      ${missingCount}`
  );

  console.log(
    `Operations prepared:    ${operations.length}`
  );

  console.log(
    "============================================================"
  );

  /*
  ============================================================
   DRY RUN
  ============================================================
  */

  if (!APPLY_MODE) {
    console.log("");

    console.log(
      "🔎 DRY RUN COMPLETE."
    );

    console.log(
      "Nothing was changed in Firestore."
    );

    console.log("");

    if (operations.length > 0) {
      console.log(
        "If the numbers look correct, run:"
      );

      console.log("");

      console.log(
        "node backend\\addPublicLessonIds.js --apply"
      );
    } else {
      console.log(
        "✅ All lessons already have publicLessonId."
      );
    }

    console.log("");

    return;
  }

  /*
  ============================================================
   APPLY
  ============================================================
  */

  if (operations.length === 0) {
    console.log("");

    console.log(
      "✅ Nothing needs to be changed."
    );

    console.log("");

    return;
  }

  console.log("");

  console.log(
    `🚀 Applying ${operations.length} update(s)...`
  );

  /*
  ============================================================
   Firestore batch
  ============================================================
  */

  const BATCH_SIZE = 450;

  let applied = 0;

  for (
    let start = 0;
    start < operations.length;
    start += BATCH_SIZE
  ) {
    const batchOperations =
      operations.slice(
        start,
        start + BATCH_SIZE
      );

    const batch =
      db.batch();

    batchOperations.forEach(
      (operation) => {
        /*
         * update() adds ONLY publicLessonId.
         *
         * It does not replace the document.
         */

        batch.update(
          operation.ref,
          operation.data
        );
      }
    );

    await batch.commit();

    applied +=
      batchOperations.length;

    console.log(
      `✅ Applied ${applied}/${operations.length}`
    );
  }

  /*
  ============================================================
   Final
  ============================================================
  */

  console.log("");

  console.log(
    "============================================================"
  );

  console.log(
    "✅ PUBLIC LESSON ID MIGRATION COMPLETE"
  );

  console.log(
    "============================================================"
  );

  console.log(
    `Updated lessons: ${applied}`
  );

  console.log("");

  console.log(
    "Only publicLessonId was added."
  );

  console.log(
    "No video, flow, PDF, title, or lesson content was modified."
  );

  console.log(
    "============================================================"
  );

  console.log("");
}

/*
==============================================================
 Run
==============================================================
*/

main()
  .catch((error) => {
    console.error("");

    console.error(
      "❌ SCRIPT FAILED"
    );

    console.error("");

    console.error(error);

    console.error("");

    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await admin.app().delete();
    } catch (_) {
      // Ignore shutdown errors.
    }
  });