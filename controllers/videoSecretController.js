// =========================================================
// backend/controllers/videoSecretController.js
// SUPER ADMIN ONLY - VIDEO SECRETS
// =========================================================

const admin = require("firebase-admin");

const {
  getFirestore,
} = require("firebase-admin/firestore");

// =========================================================
// DATABASE
// =========================================================
//
// IMPORTANT:
//
// The platform uses the named Firestore database:
//
//     el-mostashar2026
//
// Do NOT use:
//     admin.firestore()
//
// because that may resolve to the default database.
// =========================================================

function getDb() {
  return getFirestore(
    admin.app(),
    "el-mostashar2026"
  );
}

// =========================================================
// SUPER ADMIN CHECK
// =========================================================

function requireSuperAdmin(
  req,
  res
) {

  if (
    !req.user ||
    req.user.role !== "super-admin"
  ) {

    res.status(403).json({
      success: false,
      error:
        "Super Admin access required",
    });

    return false;
  }

  return true;
}

// =========================================================
// DATE SERIALIZATION
// =========================================================

function serializeTimestamp(
  value
) {

  if (!value) {
    return null;
  }

  try {

    if (
      typeof value.toDate ===
      "function"
    ) {

      return value
        .toDate()
        .toISOString();
    }

    if (
      value instanceof Date
    ) {

      return value.toISOString();
    }

    return value;

  } catch {

    return null;
  }
}

// =========================================================
// YOUTUBE ID EXTRACTION
// =========================================================

function extractYoutubeId(
  value
) {

  if (
    !value ||
    typeof value !== "string"
  ) {

    return null;
  }

  const url =
    value.trim();

  if (!url) {
    return null;
  }

  // -------------------------------------------------------
  // Plain YouTube video ID
  // -------------------------------------------------------

  if (
    /^[A-Za-z0-9_-]{11}$/.test(
      url
    )
  ) {

    return url;
  }

  // -------------------------------------------------------
  // Supported YouTube URLs
  // -------------------------------------------------------

  const patterns = [

    /youtube\.com\/watch\?[^#]*v=([A-Za-z0-9_-]{11})/i,

    /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/i,

    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/i,

    /youtube\.com\/live\/([A-Za-z0-9_-]{11})/i,

    /studio\.youtube\.com\/video\/([A-Za-z0-9_-]{11})(?:[\/?#]|$)/i,

    /youtu\.be\/([A-Za-z0-9_-]{11})/i,

  ];

  for (
    const pattern of patterns
  ) {

    const match =
      url.match(pattern);

    if (
      match &&
      match[1]
    ) {

      return match[1];
    }
  }

  return null;
}

// =========================================================
// CREATE INTERNAL VIDEO KEY
// =========================================================

function createVideoKey() {

  const crypto =
    require("crypto");

  return crypto
    .randomBytes(32)
    .toString("base64url");
}

// =========================================================
// LESSON INDEX
//
// The platform currently has two lesson locations:
//
// 1) Top-level: lessons/{lessonId}
// 2) Legacy/current nested: grades/{gradeId}/subjects/{subjectId}/units/{unitId}/lessons/{lessonId}
//
// We read both and merge by the real Firestore lesson ID so the
// Super Admin can manage old and new lessons from one screen.
// =========================================================

async function loadLessonIndex(db) {

  const [
    rootSnapshot,
    groupSnapshot,
  ] = await Promise.all([

    db
      .collection('lessons')
      .get(),

    db
      .collectionGroup('lessons')
      .get(),

  ]);

  const byId = new Map();

  const addRecord = (lessonDoc, source) => {

    const id = lessonDoc.id;
    const data = lessonDoc.data() || {};

    const current = byId.get(id);

    if (!current) {
      byId.set(id, {
        id,
        data,
        rootRef: source === 'root' ? lessonDoc.ref : null,
        nestedRefs: source === 'nested' ? [lessonDoc.ref] : [],
      });
      return;
    }

    // Root lessons are the canonical mirror when present.
    // Nested data fills any missing fields for legacy lessons.
    const mergedData =
      source === 'root'
        ? { ...current.data, ...data }
        : { ...data, ...current.data };

    current.data = mergedData;

    if (source === 'root') {
      current.rootRef = lessonDoc.ref;
    } else {
      current.nestedRefs.push(lessonDoc.ref);
    }
  };

  rootSnapshot.docs.forEach((lessonDoc) =>
    addRecord(lessonDoc, 'root')
  );

  groupSnapshot.docs.forEach((lessonDoc) =>
    addRecord(lessonDoc, 'nested')
  );

  return Array.from(byId.values());
}

async function findLessonRecord(db, lessonId) {

  const records = await loadLessonIndex(db);
  return (
    records.find((record) => record.id === lessonId) ||
    null
  );
}

// =========================================================
// GET ALL LESSONS
// SUPER ADMIN ONLY
// =========================================================

exports.listLessons =
  async (
    req,
    res
  ) => {

    if (
      !requireSuperAdmin(
        req,
        res
      )
    ) {

      return;
    }

    try {

      const db =
        getDb();

      const records =
        await loadLessonIndex(db);

      const lessons =
        records.map(
          (record) => {

            const data =
              record.data || {};

            return {

              id:
                record.id,

              title:
                data.title ||
                'بدون عنوان',

              gradeId:
                data.gradeId ||
                '',

              subjectId:
                data.subjectId ||
                '',

              unitId:
                data.unitId ||
                '',

              publicLessonId:
                data.publicLessonId ||
                '',

              active:
                data.active !== false,

              createdAt:
                serializeTimestamp(
                  data.createdAt
                ),

              updatedAt:
                serializeTimestamp(
                  data.updatedAt
                ),

            };
          }
        );

      return res.json({

        success:
          true,

        lessons,

      });

    } catch (error) {

      console.error(
        '❌ listLessons error:',
        error
      );

      return res.status(
        500
      ).json({

        success:
          false,

        error:
          error.message ||
          'Failed to load lessons',

      });
    }
  };

// =========================================================
// LIST VIDEO SECRETS
// SUPER ADMIN ONLY
// =========================================================
//
// This endpoint is the ONLY place where the backend
// intentionally returns the real YouTube information.
// It is protected by:
//
// Firebase authentication
// +
// role === super-admin
//
// =========================================================

exports.listVideoSecrets =
  async (
    req,
    res
  ) => {

    if (
      !requireSuperAdmin(
        req,
        res
      )
    ) {

      return;
    }

    try {

      const db =
        getDb();

      // ---------------------------------------------------
      // Load lessons and videos
      // ---------------------------------------------------

      const [
        lessonRecords,
        videosSnapshot,
      ] = await Promise.all([

        loadLessonIndex(db),

        db
          .collection(
            'lessonVideos'
          )
          .get(),

      ]);

      // ---------------------------------------------------
      // Build lesson map
      // ---------------------------------------------------

      const lessonMap =
        new Map();

      for (
        const record of lessonRecords
      ) {

        lessonMap.set(
          record.id,
          {
            ...(record.data || {}),
            id: record.id,
          }
        );
      }

// ---------------------------------------------------
      // Build result
      // ---------------------------------------------------

      const videos =
        videosSnapshot.docs
          .map(
            (videoDoc) => {

              const videoData =
                videoDoc.data() ||
                {};

              const lessonId =
                videoDoc.id;

              const lesson =
                lessonMap.get(
                  lessonId
                ) || {};

              const youtubeVideoId =
                videoData.youtubeVideoId ||
                null;

              return {

                // -----------------------------------------
                // Identity
                // -----------------------------------------

                lessonId,

                title:
                  lesson.title ||
                  "بدون عنوان",

                gradeId:
                  lesson.gradeId ||
                  videoData.gradeId ||
                  "",

                subjectId:
                  lesson.subjectId ||
                  videoData.subjectId ||
                  "",

                unitId:
                  lesson.unitId ||
                  videoData.unitId ||
                  "",

                publicLessonId:
                  lesson.publicLessonId ||
                  videoData.publicLessonId ||
                  "",

                // -----------------------------------------
                // SECRET VIDEO DATA
                // -----------------------------------------

                videoKey:
                  videoData.videoKey ||
                  null,

                videoType:
                  videoData.videoType ||
                  "youtube",

                youtubeVideoId,

                youtubeUrl:
                  youtubeVideoId
                    ? `https://www.youtube.com/watch?v=${youtubeVideoId}`
                    : "",

                embedUrl:
                  youtubeVideoId
                    ? `https://www.youtube.com/embed/${youtubeVideoId}`
                    : "",

                updatedAt:
                  serializeTimestamp(
                    videoData.updatedAt
                  ),

                updatedBy:
                  videoData.updatedBy ||
                  null,

              };
            }
          );

      return res.json({

        success:
          true,

        videos,

      });

    } catch (error) {

      console.error(
        "❌ listVideoSecrets error:",
        error
      );

      return res.status(
        500
      ).json({

        success:
          false,

        error:
          error.message ||
          "Failed to load video secrets",

      });
    }
  };

// =========================================================
// GET ONE VIDEO SECRET
// SUPER ADMIN ONLY
// =========================================================

exports.getVideoSecret =
  async (
    req,
    res
  ) => {

    if (
      !requireSuperAdmin(
        req,
        res
      )
    ) {

      return;
    }

    try {

      const lessonId =
        String(
          req.params.lessonId ||
            ""
        ).trim();

      if (!lessonId) {

        return res.status(
          400
        ).json({

          success:
            false,

          error:
            "lessonId is required",

        });
      }

      const db =
        getDb();

      // ---------------------------------------------------
      // Video
      // ---------------------------------------------------

      const videoSnap =
        await db
          .collection(
            "lessonVideos"
          )
          .doc(
            lessonId
          )
          .get();

      if (
        !videoSnap.exists
      ) {

        return res.status(
          404
        ).json({

          success:
            false,

          error:
            "Video secret not found",

        });
      }

      const videoData =
        videoSnap.data() ||
        {};

      // ---------------------------------------------------
      // Lesson
      // ---------------------------------------------------

      const lessonRecord =
        await findLessonRecord(
          db,
          lessonId
        );

      const lessonData =
        lessonRecord?.data || {};

      // ---------------------------------------------------
      // YouTube ID
      // ---------------------------------------------------

      const youtubeVideoId =
        videoData.youtubeVideoId ||
        null;

      return res.json({

        success:
          true,

        video: {

          lessonId,

          title:
            lessonData.title ||
            "بدون عنوان",

          gradeId:
            lessonData.gradeId ||
            videoData.gradeId ||
            "",

          subjectId:
            lessonData.subjectId ||
            videoData.subjectId ||
            "",

          unitId:
            lessonData.unitId ||
            videoData.unitId ||
            "",

          publicLessonId:
            lessonData.publicLessonId ||
            videoData.publicLessonId ||
            "",

          videoKey:
            videoData.videoKey ||
            null,

          videoType:
            videoData.videoType ||
            "youtube",

          youtubeVideoId,

          youtubeUrl:
            youtubeVideoId
              ? `https://www.youtube.com/watch?v=${youtubeVideoId}`
              : "",

          embedUrl:
            youtubeVideoId
              ? `https://www.youtube.com/embed/${youtubeVideoId}`
              : "",

          updatedAt:
            serializeTimestamp(
              videoData.updatedAt
            ),

          updatedBy:
            videoData.updatedBy ||
            null,

        },

      });

    } catch (error) {

      console.error(
        "❌ getVideoSecret error:",
        error
      );

      return res.status(
        500
      ).json({

        success:
          false,

        error:
          error.message ||
          "Failed to load video secret",

      });
    }
  };

// =========================================================
// SAVE / UPDATE VIDEO SECRET
// SUPER ADMIN ONLY
// =========================================================
//
// URL is accepted here and nowhere else.
//
// Example:
//
// POST /api/video-secrets/{REAL_LESSON_DOCUMENT_ID}
//
// body:
//
// {
//   "youtubeUrl":
//     "https://www.youtube.com/watch?v=XXXXXXXXXXX"
// }
//
// =========================================================

exports.saveVideoSecret =
  async (
    req,
    res
  ) => {

    if (
      !requireSuperAdmin(
        req,
        res
      )
    ) {

      return;
    }

    try {

      const lessonId =
        String(
          req.params.lessonId ||
            ""
        ).trim();

      const youtubeUrl =
        typeof req.body?.youtubeUrl ===
        "string"
          ? req.body.youtubeUrl.trim()
          : "";

      // ---------------------------------------------------
      // Validate lesson ID
      // ---------------------------------------------------

      if (!lessonId) {

        return res.status(
          400
        ).json({

          success:
            false,

          error:
            "lessonId is required",

        });
      }

      // ---------------------------------------------------
      // Validate YouTube URL
      // ---------------------------------------------------

      const youtubeVideoId =
        extractYoutubeId(
          youtubeUrl
        );

      if (!youtubeVideoId) {

        return res.status(
          400
        ).json({

          success:
            false,

          error:
            "Invalid YouTube URL",

        });
      }

      const db =
        getDb();

      // ---------------------------------------------------
      // Verify REAL lesson document
      // Supports both the new top-level mirror and legacy
      // nested lesson documents.
      // ---------------------------------------------------

      const lessonRecord =
        await findLessonRecord(
          db,
          lessonId
        );

      if (!lessonRecord) {

        return res.status(
          404
        ).json({

          success:
            false,

          error:
            'Lesson not found',

        });
      }

      const lessonData =
        lessonRecord.data || {};

      const lessonRef =
        db
          .collection(
            'lessons'
          )
          .doc(
            lessonId
          );

      // Create/update the top-level mirror for legacy lessons.
      await lessonRef.set(
        {
          id: lessonId,
          title:
            lessonData.title ||
            'بدون عنوان',
          description:
            lessonData.description ||
            '',
          active:
            lessonData.active !== false,
          gradeId:
            lessonData.gradeId ||
            null,
          subjectId:
            lessonData.subjectId ||
            null,
          unitId:
            lessonData.unitId ||
            null,
          publicLessonId:
            lessonData.publicLessonId ||
            null,
          updatedAt:
            admin.firestore
              .FieldValue
              .serverTimestamp(),
        },
        {
          merge: true,
        }
      );

      // ---------------------------------------------------
      // Generate new internal key
      // ---------------------------------------------------

      const videoKey =
        createVideoKey();

      // ---------------------------------------------------
      // Save protected video
      // ---------------------------------------------------
      //
      // IMPORTANT:
      //
      // The real YouTube ID exists in Firestore here.
      //
      // Students do NOT have direct Firestore access
      // to lessonVideos.
      //
      // Normal playback endpoint does NOT return this ID.
      //
      // Only Super Admin secret endpoints do.
      //
      // ---------------------------------------------------

      const videoRef =
        db
          .collection(
            "lessonVideos"
          )
          .doc(
            lessonId
          );

      await videoRef.set({

        lessonId,

        publicLessonId:
          lessonData.publicLessonId ||
          null,

        videoKey,

        youtubeVideoId,

        videoType:
          "youtube",

        gradeId:
          lessonData.gradeId ||
          null,

        subjectId:
          lessonData.subjectId ||
          null,

        unitId:
          lessonData.unitId ||
          null,

        updatedAt:
          admin.firestore
            .FieldValue
            .serverTimestamp(),

        updatedBy:
          req.user.uid,

      }, {
        merge:
          true,
      });

      // ---------------------------------------------------
      // Remove legacy video fields from lesson
      // ---------------------------------------------------

      const legacyVideoFields = {
        videoUrl:
          admin.firestore
            .FieldValue
            .delete(),

        videoLink:
          admin.firestore
            .FieldValue
            .delete(),

        videoType:
          admin.firestore
            .FieldValue
            .delete(),

        video:
          admin.firestore
            .FieldValue
            .delete(),
      };

      await lessonRef.update(
        legacyVideoFields
      );

      for (
        const nestedRef of
          lessonRecord.nestedRefs || []
      ) {
        try {
          await nestedRef.update(
            legacyVideoFields
          );
        } catch (nestedError) {
          console.warn(
            '⚠️ Could not update legacy nested lesson:',
            nestedError?.message ||
              nestedError
          );
        }
      }

      // ---------------------------------------------------
      // Return secret
      // ---------------------------------------------------
      //
      // This response is ONLY available to super-admin.
      //
      // The normal student playback endpoint does not
      // return these fields.
      //
      // ---------------------------------------------------

      return res.json({

        success:
          true,

        message:
          "Video secret saved successfully",

        video: {

          lessonId,

          publicLessonId:
            lessonData.publicLessonId ||
            null,

          videoKey,

          youtubeVideoId,

          youtubeUrl:
            `https://www.youtube.com/watch?v=${youtubeVideoId}`,

          embedUrl:
            `https://www.youtube.com/embed/${youtubeVideoId}`,

        },

      });

    } catch (error) {

      console.error(
        "❌ saveVideoSecret error:",
        error
      );

      return res.status(
        500
      ).json({

        success:
          false,

        error:
          error.message ||
          "Failed to save video secret",

      });
    }
  };

// =========================================================
// DELETE VIDEO SECRET
// SUPER ADMIN ONLY
// =========================================================

exports.deleteVideoSecret =
  async (
    req,
    res
  ) => {

    if (
      !requireSuperAdmin(
        req,
        res
      )
    ) {

      return;
    }

    try {

      const lessonId =
        String(
          req.params.lessonId ||
            ""
        ).trim();

      if (!lessonId) {

        return res.status(
          400
        ).json({

          success:
            false,

          error:
            "lessonId is required",

        });
      }

      const db =
        getDb();

      const videoRef =
        db
          .collection(
            "lessonVideos"
          )
          .doc(
            lessonId
          );

      const videoSnap =
        await videoRef.get();

      if (
        !videoSnap.exists
      ) {

        return res.status(
          404
        ).json({

          success:
            false,

          error:
            "Video secret not found",

        });
      }

      /*
       * Delete only the protected video document.
       *
       * We intentionally do NOT recreate old videoUrl
       * fields inside lessons.
       */

      await videoRef.delete();

      return res.json({

        success:
          true,

        message:
          "Video secret deleted",

        lessonId,

      });

    } catch (error) {

      console.error(
        "❌ deleteVideoSecret error:",
        error
      );

      return res.status(
        500
      ).json({

        success:
          false,

        error:
          error.message ||
          "Failed to delete video secret",

      });
    }
  };