/**
 * migrateLessonPublicIds.js
 *
 * One-time migration for the El-Mostashar platform.
 *
 * Firestore database:
 *   el-mostashar2026
 *
 * What this script does:
 *
 * 1) Walks ONLY:
 *    grades/{gradeId}/subjects/{subjectId}/units/{unitId}/lessons/{lessonId}
 *
 * 2) Gives every lesson a publicLessonId if it does not already have one.
 *
 * 3) Moves an old YouTube video URL from the lesson document to:
 *    lessonVideos/{lessonId}
 *
 * 4) Removes the old video fields from the lesson document after the
 *    protected video document exists.
 *
 * 5) DRY RUN is the default.
 *    Nothing is changed unless you run with --apply.
 *
 * Run:
 *   node backend/migrateLessonPublicIds.js
 *
 * After reviewing the output:
 *   node backend/migrateLessonPublicIds.js --apply
 */

const admin = require("firebase-admin");
const path = require("path");
const fs = require("fs");

const APPLY = process.argv.includes("--apply");

/* ============================================================
   SERVICE ACCOUNT
   ============================================================ */

const serviceAccountPath = path.resolve(
  __dirname,
  "keys",
  "serviceAccountKey.json"
);

if (!fs.existsSync(serviceAccountPath)) {
  console.error("\n❌ serviceAccountKey.json was not found.");
  console.error(`Expected:\n${serviceAccountPath}\n`);
  process.exit(1);
}

let serviceAccount;

try {
  serviceAccount = require(serviceAccountPath);
} catch (error) {
  console.error("\n❌ Could not read serviceAccountKey.json.");
  console.error(error.message);
  process.exit(1);
}

/* ============================================================
   FIREBASE INITIALIZATION
   ============================================================ */

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

/*
 * IMPORTANT:
 *
 * Your Firebase project contains a named Firestore database:
 *
 *     el-mostashar2026
 *
 * Therefore we MUST explicitly select it.
 *
 * If we use:
 *
 *     admin.firestore()
 *
 * the Admin SDK uses the default database.
 *
 * Your actual platform data is in:
 *
 *     el-mostashar2026
 */

const { getFirestore } = require("firebase-admin/firestore");

const db = getFirestore(
  admin.app(),
  "el-mostashar2026"
);

const FieldValue = admin.firestore.FieldValue;

/* ============================================================
   GENERATED PUBLIC IDs
   ============================================================ */

const generatedIds = new Set();

function generatePublicLessonId() {
  /*
   * Characters intentionally avoid ambiguous characters such as:
   * 0, O, I, l, 1
   */

  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

  let id = "";

  do {
    id = "";

    for (let i = 0; i < 12; i += 1) {
      id += chars[
        Math.floor(
          Math.random() * chars.length
        )
      ];
    }
  } while (generatedIds.has(id));

  generatedIds.add(id);

  return id;
}

/* ============================================================
   YOUTUBE ID EXTRACTION
   ============================================================ */

function extractYoutubeId(value) {
  if (!value || typeof value !== "string") {
    return null;
  }

  const url = value.trim();

  if (!url) {
    return null;
  }

  /*
   * Plain YouTube video ID
   */

  if (/^[A-Za-z0-9_-]{11}$/.test(url)) {
    return url;
  }

  /*
   * Supported formats:
   *
   * https://www.youtube.com/watch?v=XXXXXXXXXXX
   * https://youtu.be/XXXXXXXXXXX
   * https://www.youtube.com/embed/XXXXXXXXXXX
   * https://www.youtube.com/shorts/XXXXXXXXXXX
   * https://www.youtube.com/live/XXXXXXXXXXX
   */

  const patterns = [
    /youtube\.com\/watch\?[^#]*v=([A-Za-z0-9_-]{11})/i,

    /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/i,

    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/i,

    /youtube\.com\/live\/([A-Za-z0-9_-]{11})/i,

    /youtu\.be\/([A-Za-z0-9_-]{11})/i,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);

    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

/* ============================================================
   YOUTUBE EMBED URL
   ============================================================ */

function makeYoutubeEmbedUrl(videoId) {
  return `https://www.youtube.com/embed/${videoId}`;
}

/* ============================================================
   LEGACY VIDEO URL
   ============================================================ */

function getLegacyVideoUrl(data) {
  if (!data || typeof data !== "object") {
    return null;
  }

  /*
   * Old possible locations:
   *
   * videoUrl
   * videoLink
   * video.url
   */

  const candidates = [
    data.videoUrl,

    data.videoLink,

    data.video &&
      data.video.url,
  ];

  for (const candidate of candidates) {
    if (
      typeof candidate === "string" &&
      candidate.trim()
    ) {
      return candidate.trim();
    }
  }

  return null;
}

/* ============================================================
   LEGACY VIDEO TYPE
   ============================================================ */

function getLegacyVideoType(data) {
  if (!data || typeof data !== "object") {
    return null;
  }

  if (
    typeof data.videoType === "string"
  ) {
    return data.videoType;
  }

  if (
    data.video &&
    typeof data.video.type === "string"
  ) {
    return data.video.type;
  }

  return null;
}

/* ============================================================
   HEADER
   ============================================================ */

function printHeader() {
  console.log(
    "\n============================================================"
  );

  console.log(
    " El-Mostashar - Lesson Public ID Migration"
  );

  console.log(
    "============================================================"
  );

  console.log(
    "Firestore database: el-mostashar2026"
  );

  console.log(
    APPLY
      ? "⚠️  MODE: APPLY - Firestore WILL be changed"
      : "🔎 MODE: DRY RUN - Firestore will NOT be changed"
  );

  console.log(
    "============================================================\n"
  );
}

/* ============================================================
   PROCESS ONE LESSON
   ============================================================ */

async function processLesson({
  gradeId,
  subjectId,
  unitId,
  lessonDoc,
}) {
  const lessonId = lessonDoc.id;

  const data =
    lessonDoc.data() || {};

  const lessonRef =
    lessonDoc.ref;

  /*
   * Protected video document:
   *
   * lessonVideos/{realLessonId}
   */

  const protectedVideoRef =
    db
      .collection("lessonVideos")
      .doc(lessonId);

  /*
   * Existing public ID?
   *
   * If not, generate one.
   */

  const publicLessonId =
    typeof data.publicLessonId === "string" &&
    data.publicLessonId.trim()
      ? data.publicLessonId.trim()
      : generatePublicLessonId();

  /*
   * Find old video information.
   */

  const legacyVideoUrl =
    getLegacyVideoUrl(data);

  const legacyVideoType =
    getLegacyVideoType(data);

  /*
   * Check if protected video already exists.
   */

  const existingProtectedVideo =
    await protectedVideoRef.get();

  /*
   * Try to extract YouTube ID.
   */

  let youtubeId = null;

  if (legacyVideoUrl) {
    youtubeId =
      extractYoutubeId(
        legacyVideoUrl
      );
  }

  const result = {
    lessonId,

    publicLessonId,

    gradeId,

    subjectId,

    unitId,

    hadPublicLessonId:
      Boolean(data.publicLessonId),

    legacyVideoUrl,

    legacyVideoType,

    protectedVideoExists:
      existingProtectedVideo.exists,

    youtubeId,

    changed: false,

    warning: null,
  };

  /* ==========================================================
     1. ADD publicLessonId
     ========================================================== */

  if (!data.publicLessonId) {
    result.changed = true;

    if (APPLY) {
      await lessonRef.update({
        publicLessonId,
      });

      console.log(
        `   ✓ publicLessonId added: ${publicLessonId}`
      );
    } else {
      console.log(
        `   [DRY RUN] Would add publicLessonId: ${publicLessonId}`
      );
    }
  } else {
    console.log(
      `   ✓ Existing publicLessonId: ${publicLessonId}`
    );
  }

  /* ==========================================================
     2. MIGRATE LEGACY VIDEO
     ========================================================== */

  if (legacyVideoUrl) {
    /*
     * Protected video already exists.
     */

    if (
      existingProtectedVideo.exists
    ) {
      console.log(
        `   ✓ Protected video already exists: lessonVideos/${lessonId}`
      );
    }

    /*
     * No protected video exists,
     * but old video is a valid YouTube URL.
     */

    else if (youtubeId) {
      const embedUrl =
        makeYoutubeEmbedUrl(
          youtubeId
        );

      result.changed = true;

      if (APPLY) {
        await protectedVideoRef.set({
          lessonId,

          videoUrl:
            embedUrl,

          videoType:
            "youtube",

          gradeId,

          subjectId,

          unitId,

          migratedFromLegacyLesson:
            true,

          migratedAt:
            FieldValue.serverTimestamp(),

          updatedAt:
            FieldValue.serverTimestamp(),
        });

        console.log(
          `   ✓ Video migrated -> lessonVideos/${lessonId}`
        );
      } else {
        console.log(
          `   [DRY RUN] Would migrate YouTube video -> lessonVideos/${lessonId}`
        );

        console.log(
          `      YouTube ID: ${youtubeId}`
        );

        console.log(
          `      Embed URL: ${embedUrl}`
        );
      }
    }

    /*
     * Old video exists but is not recognized
     * as a YouTube URL.
     *
     * IMPORTANT:
     * We DO NOT delete it.
     */

    else {
      result.warning =
        "Legacy video URL is not recognized as a YouTube URL. It was NOT deleted.";

      console.log(
        "   ⚠️ Legacy video is not a recognized YouTube URL."
      );

      console.log(
        "      The old video fields will be preserved."
      );
    }
  }

  /* ==========================================================
     3. REMOVE OLD VIDEO FIELDS
     ========================================================== */

  /*
   * We can remove old fields when:
   *
   * - There is no old video
   *
   * OR
   *
   * - Protected video already exists
   *
   * OR
   *
   * - Old video is a valid YouTube video
   *   and will be migrated.
   */

  const canRemoveLegacyVideoFields =
    !legacyVideoUrl ||
    existingProtectedVideo.exists ||
    Boolean(youtubeId);

  if (
    canRemoveLegacyVideoFields
  ) {
    const legacyFieldsExist =
      Object.prototype.hasOwnProperty.call(
        data,
        "videoUrl"
      ) ||

      Object.prototype.hasOwnProperty.call(
        data,
        "videoLink"
      ) ||

      Object.prototype.hasOwnProperty.call(
        data,
        "videoType"
      ) ||

      Object.prototype.hasOwnProperty.call(
        data,
        "video"
      );

    if (legacyFieldsExist) {
      result.changed = true;

      if (APPLY) {
        await lessonRef.update({
          videoUrl:
            FieldValue.delete(),

          videoLink:
            FieldValue.delete(),

          videoType:
            FieldValue.delete(),

          video:
            FieldValue.delete(),
        });

        console.log(
          "   ✓ Old video fields removed from lesson document."
        );
      } else {
        console.log(
          "   [DRY RUN] Would remove old video fields from lesson document."
        );
      }
    }
  }

  return result;
}

/* ============================================================
   MAIN MIGRATION
   ============================================================ */

async function migrate() {
  printHeader();

  let gradesProcessed = 0;

  let subjectsProcessed = 0;

  let unitsProcessed = 0;

  let lessonsProcessed = 0;

  let lessonsChanged = 0;

  let videosMigrated = 0;

  let warnings = 0;

  /* ==========================================================
     ONLY NESTED CURRICULUM STRUCTURE
     ========================================================== */

  /*
   * IMPORTANT:
   *
   * We intentionally DO NOT scan:
   *
   * lessons/{lessonId}
   *
   * at the root level.
   *
   * We scan ONLY:
   *
   * grades/{gradeId}/subjects/{subjectId}/units/{unitId}/lessons
   */

  const gradesSnapshot =
    await db
      .collection("grades")
      .get();

  console.log(
    `Found ${gradesSnapshot.size} grade document(s).\n`
  );

  /* ==========================================================
     GRADES
     ========================================================== */

  for (
    const gradeDoc
    of gradesSnapshot.docs
  ) {
    const gradeId =
      gradeDoc.id;

    gradesProcessed += 1;

    console.log(
      `📚 Grade: ${gradeId}`
    );

    /* ========================================================
       SUBJECTS
       ======================================================== */

    const subjectsSnapshot =
      await db
        .collection("grades")
        .doc(gradeId)
        .collection("subjects")
        .get();

    subjectsProcessed +=
      subjectsSnapshot.size;

    for (
      const subjectDoc
      of subjectsSnapshot.docs
    ) {
      const subjectId =
        subjectDoc.id;

      console.log(
        `  📖 Subject: ${subjectId}`
      );

      /* ======================================================
         UNITS
         ====================================================== */

      const unitsSnapshot =
        await db
          .collection("grades")
          .doc(gradeId)
          .collection("subjects")
          .doc(subjectId)
          .collection("units")
          .get();

      unitsProcessed +=
        unitsSnapshot.size;

      for (
        const unitDoc
        of unitsSnapshot.docs
      ) {
        const unitId =
          unitDoc.id;

        console.log(
          `    📦 Unit: ${unitId}`
        );

        /* ====================================================
           LESSONS
           ==================================================== */

        const lessonsSnapshot =
          await db
            .collection("grades")
            .doc(gradeId)
            .collection("subjects")
            .doc(subjectId)
            .collection("units")
            .doc(unitId)
            .collection("lessons")
            .get();

        for (
          const lessonDoc
          of lessonsSnapshot.docs
        ) {
          lessonsProcessed += 1;

          console.log(
            `      🎓 Lesson: ${lessonDoc.id}`
          );

          const result =
            await processLesson({
              gradeId,

              subjectId,

              unitId,

              lessonDoc,
            });

          if (result.changed) {
            lessonsChanged += 1;
          }

          /*
           * Count videos that would be migrated.
           */

          if (
            result.legacyVideoUrl &&
            result.youtubeId &&
            !result.protectedVideoExists
          ) {
            videosMigrated += 1;
          }

          if (result.warning) {
            warnings += 1;
          }

          console.log(
            `         Public ID: ${result.publicLessonId}`
          );
        }
      }
    }

    console.log("");
  }

  /* ==========================================================
     SUMMARY
     ========================================================== */

  console.log(
    "\n============================================================"
  );

  console.log(
    " Migration Summary"
  );

  console.log(
    "============================================================"
  );

  console.log(
    `Firestore database:     el-mostashar2026`
  );

  console.log(
    `Grades processed:       ${gradesProcessed}`
  );

  console.log(
    `Subjects processed:     ${subjectsProcessed}`
  );

  console.log(
    `Units processed:        ${unitsProcessed}`
  );

  console.log(
    `Lessons processed:      ${lessonsProcessed}`
  );

  console.log(
    `Lessons needing change: ${lessonsChanged}`
  );

  console.log(
    `Videos to migrate:      ${videosMigrated}`
  );

  console.log(
    `Warnings:               ${warnings}`
  );

  console.log(
    "============================================================"
  );

  /* ==========================================================
     DRY RUN
     ========================================================== */

  if (!APPLY) {
    console.log(
      "\n🔎 DRY RUN COMPLETE."
    );

    console.log(
      "Nothing was changed in Firestore."
    );

    console.log(
      "\nIf the output looks correct, run:"
    );

    console.log(
      "node backend/migrateLessonPublicIds.js --apply\n"
    );
  }

  /* ==========================================================
     APPLY
     ========================================================== */

  else {
    console.log(
      "\n✅ MIGRATION COMPLETE."
    );

    console.log(
      "Firestore changes have been applied.\n"
    );
  }
}

/* ============================================================
   RUN
   ============================================================ */

migrate()
  .catch((error) => {
    console.error(
      "\n❌ MIGRATION FAILED\n"
    );

    console.error(error);

    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await admin.app().delete();
    } catch (_) {
      /*
       * Ignore shutdown errors.
       */
    }
  });