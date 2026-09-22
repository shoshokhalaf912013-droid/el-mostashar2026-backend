const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

const serviceAccountPath = path.resolve(
  __dirname,
  "keys",
  "serviceAccountKey.json"
);

if (!fs.existsSync(serviceAccountPath)) {
  console.error("❌ serviceAccountKey.json not found:");
  console.error(serviceAccountPath);
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const { getFirestore } = require("firebase-admin/firestore");

const db = getFirestore(
  admin.app(),
  "el-mostashar2026"
);

function printDocuments(title, snapshot, limit = 10) {
  console.log("");
  console.log("============================================================");
  console.log(title);
  console.log("============================================================");
  console.log(`Count: ${snapshot.size}`);

  const docs = snapshot.docs.slice(0, limit);

  docs.forEach((doc, index) => {
    console.log("");
    console.log(`--- ${index + 1}. Document ID: ${doc.id} ---`);
    console.log(JSON.stringify(doc.data(), null, 2));
  });

  if (snapshot.size > limit) {
    console.log("");
    console.log(`... showing first ${limit} documents only`);
  }
}

async function inspect() {
  console.log("");
  console.log("============================================================");
  console.log(" EL-MOSTASHAR FIRESTORE STRUCTURE INSPECTOR");
  console.log("============================================================");
  console.log("Project: el-mostashar2026");
  console.log("Database: el-mostashar2026");
  console.log("MODE: READ ONLY");
  console.log("NO FIRESTORE DATA WILL BE CHANGED");
  console.log("============================================================");

  /* ==========================================================
     GRADES
     ========================================================== */

  const gradesSnap = await db
    .collection("grades")
    .get();

  printDocuments(
    "📚 GRADES",
    gradesSnap,
    20
  );

  /* ==========================================================
     SUBJECTS
     ========================================================== */

  const subjectsSnap = await db
    .collection("subjects")
    .get();

  printDocuments(
    "📖 TOP-LEVEL SUBJECTS",
    subjectsSnap,
    20
  );

  /* ==========================================================
     UNITS
     ========================================================== */

  const unitsSnap = await db
    .collection("units")
    .get();

  printDocuments(
    "📦 TOP-LEVEL UNITS",
    unitsSnap,
    20
  );

  /* ==========================================================
     LESSONS
     ========================================================== */

  const lessonsSnap = await db
    .collection("lessons")
    .get();

  printDocuments(
    "🎓 TOP-LEVEL LESSONS",
    lessonsSnap,
    20
  );

  /* ==========================================================
     GRADE SUBJECTS
     ========================================================== */

  const gradeSubjectsSnap = await db
    .collection("gradeSubjects")
    .get();

  printDocuments(
    "🔗 GRADE SUBJECTS",
    gradeSubjectsSnap,
    20
  );

  /* ==========================================================
     TRACK SUBJECTS
     ========================================================== */

  const trackSubjectsSnap = await db
    .collection("trackSubjects")
    .get();

  printDocuments(
    "🔗 TRACK SUBJECTS",
    trackSubjectsSnap,
    20
  );

  /* ==========================================================
     RESULT
     ========================================================== */

  console.log("");
  console.log("============================================================");
  console.log(" INSPECTION COMPLETE");
  console.log("============================================================");

  console.log("");
  console.log("Nothing was changed in Firestore.");
  console.log("");
}

inspect()
  .catch((error) => {
    console.error("");
    console.error("❌ INSPECTION FAILED");
    console.error("");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await admin.app().delete();
    } catch (_) {
      // Ignore shutdown error.
    }
  });