// =========================================================
// backend/controllers/videoController.js
// PROTECTED VIDEO ACCESS
// =========================================================

const crypto =
  require("crypto");

const admin =
  require("firebase-admin");

const {
  getFirestore,
} =
  require(
    "firebase-admin/firestore"
  );


// =========================================================
// DATABASE
// =========================================================

function getDb() {

  return getFirestore(
    admin.app(),
    "el-mostashar2026"
  );
}


// =========================================================
// SECURITY CONFIG
// =========================================================

const VIDEO_STATUS_LIMIT =
  30;

const VIDEO_ACCESS_LIMIT =
  60;

const RATE_WINDOW_MS =
  5 * 60 * 1000;


// مدة جلسة المشاهدة
const VIDEO_SESSION_TTL_MS =
  2 * 60 * 1000;


// أقل مدة بين إنشاء جلستين لنفس الطالب/الدرس
const SESSION_RECREATE_COOLDOWN_MS =
  15 * 1000;


// =========================================================
// IN-MEMORY STORES
// =========================================================

const rateStore =
  new Map();

const videoSessions =
  new Map();


// =========================================================
// CLEANUP
// =========================================================

function cleanupStores() {

  const now =
    Date.now();


  // -----------------------------------------------
  // Rate limits
  // -----------------------------------------------

  for (
    const [
      key,
      value,
    ] of rateStore.entries()
  ) {

    if (
      value.resetAt <= now
    ) {

      rateStore.delete(
        key
      );
    }
  }


  // -----------------------------------------------
  // Sessions
  // -----------------------------------------------

  for (
    const [
      sessionId,
      session,
    ] of videoSessions.entries()
  ) {

    if (
      session.expiresAt <= now
    ) {

      videoSessions.delete(
        sessionId
      );
    }
  }
}


// =========================================================
// PERIODIC CLEANUP
// =========================================================

setInterval(
  cleanupStores,
  60 * 1000
).unref();


// =========================================================
// CLIENT IP
// =========================================================

function getClientIp(
  req
) {

  const forwarded =
    req.headers[
      "x-forwarded-for"
    ];


  if (
    typeof forwarded ===
      "string" &&
    forwarded.trim()
  ) {

    return forwarded
      .split(",")[0]
      .trim();
  }


  return (
    req.ip ||
    req.socket?.remoteAddress ||
    "unknown"
  );
}


// =========================================================
// USER AGENT
// =========================================================

function getUserAgent(
  req
) {

  return String(
    req.headers[
      "user-agent"
    ] || ""
  );
}


// =========================================================
// USER AGENT HASH
// =========================================================

function getUserAgentHash(
  req
) {

  return crypto
    .createHash(
      "sha256"
    )
    .update(
      getUserAgent(req)
    )
    .digest("hex");
}


// =========================================================
// RATE LIMIT
// =========================================================

function checkRateLimit(
  req,
  type
) {

  const uid =
    req.user?.uid ||
    "anonymous";


  const ip =
    getClientIp(req);


  const key =
    `${type}:${uid}:${ip}`;


  const limit =
    type === "access"
      ? VIDEO_ACCESS_LIMIT
      : VIDEO_STATUS_LIMIT;


  const now =
    Date.now();


  let entry =
    rateStore.get(
      key
    );


  if (
    !entry ||
    entry.resetAt <= now
  ) {

    entry = {

      count: 0,

      resetAt:
        now +
        RATE_WINDOW_MS,

    };

    rateStore.set(
      key,
      entry
    );
  }


  entry.count +=
    1;


  if (
    entry.count >
    limit
  ) {

    return {

      allowed:
        false,

      retryAfter:
        Math.ceil(
          (
            entry.resetAt -
            now
          ) / 1000
        ),

    };
  }


  return {

    allowed:
      true,

    retryAfter:
      0,

  };
}


// =========================================================
// DATE
// =========================================================

function normalizeDate(
  value
) {

  if (!value) {
    return null;
  }


  try {

    if (
      value &&
      typeof value.toDate ===
        "function"
    ) {

      return value.toDate();
    }


    const date =
      value instanceof Date
        ? value
        : new Date(value);


    if (
      Number.isNaN(
        date.getTime()
      )
    ) {

      return null;
    }


    return date;

  } catch {

    return null;
  }
}


// =========================================================
// ACTIVE SUBSCRIPTION
// =========================================================

function hasActiveSubscription(
  userData
) {

  if (
    !userData
  ) {

    return false;
  }


  if (
    userData.role !==
    "student"
  ) {

    return false;
  }


  if (
    userData.subscriptionStatus !==
    "active"
  ) {

    return false;
  }


  const endDate =
    normalizeDate(
      userData.subscriptionEnd
    );


  if (!endDate) {

    return false;
  }


  return (
    endDate.getTime() >
    Date.now()
  );
}


// =========================================================
// YOUTUBE ID
// =========================================================

function extractYoutubeId(
  value
) {

  if (
    !value ||
    typeof value !==
      "string"
  ) {

    return null;
  }


  const url =
    value.trim();


  if (!url) {

    return null;
  }


  if (
    /^[A-Za-z0-9_-]{11}$/.test(
      url
    )
  ) {

    return url;
  }


  const patterns = [

    /youtube\.com\/watch\?[^#]*v=([A-Za-z0-9_-]{11})/i,

    /youtube\.com\/embed\/([A-Za-z0-9_-]{11})/i,

    /youtube\.com\/shorts\/([A-Za-z0-9_-]{11})/i,

    /youtube\.com\/live\/([A-Za-z0-9_-]{11})/i,

    /youtu\.be\/([A-Za-z0-9_-]{11})/i,

  ];


  for (
    const pattern of
      patterns
  ) {

    const match =
      url.match(
        pattern
      );


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
// FRONTEND ORIGIN
// =========================================================

function getBackendOrigin(
  req
) {

  const configuredOrigin =
    process.env.BACKEND_URL ||
    process.env.API_URL;

  if (configuredOrigin) {
    return configuredOrigin.replace(
      /\/+$/,
      ""
    );
  }

  const forwardedProto =
    String(
      req.headers["x-forwarded-proto"] ||
      req.protocol ||
      "https"
    )
      .split(",")[0]
      .trim();

  const forwardedHost =
    String(
      req.headers["x-forwarded-host"] ||
      req.get("host") ||
      ""
    )
      .split(",")[0]
      .trim();

  return `${forwardedProto}://${forwardedHost}`
    .replace(/\/+$/, "");
}


function getFrontendOrigin(
  req
) {

  const configuredOrigin =
    process.env.FRONTEND_URL;


  if (
    configuredOrigin
  ) {

    return configuredOrigin
      .replace(
        /\/+$/,
        ""
      );
  }


  const requestOrigin =
    req.headers.origin;


  if (
    typeof requestOrigin ===
      "string" &&
    requestOrigin
  ) {

    return requestOrigin
      .replace(
        /\/+$/,
        ""
      );
  }


  return "";
}


// =========================================================
// YOUTUBE EMBED URL
// =========================================================

function createYoutubeEmbedUrl(
  req,
  youtubeVideoId
) {

  // YouTube is embedded inside the backend Gate page.
  // Therefore YouTube's origin parameter must be the Gate/backend origin.
  const origin =
    getBackendOrigin(
      req
    );


  const params =
    new URLSearchParams();


  params.set(
    "rel",
    "0"
  );


  params.set(
    "playsinline",
    "1"
  );

  // Required for YouTube postMessage playback commands
  // such as setPlaybackRate / seekTo.
  params.set(
    "enablejsapi",
    "1"
  );


  params.set(
    "iv_load_policy",
    "3"
  );


  if (
    origin
  ) {

    params.set(
      "origin",
      origin
    );
  }


  return (
    "https://www.youtube-nocookie.com/embed/" +
    `${youtubeVideoId}?${params.toString()}`
  );
}


// =========================================================
// CREATE PLAYBACK SESSION
// =========================================================

function createVideoSession(
  req,
  lessonId
) {

  const uid =
    req.user.uid;


  const ip =
    getClientIp(req);


  const userAgentHash =
    getUserAgentHash(req);


  const now =
    Date.now();


  // -------------------------------------------------------
  // Find existing sessions for same student + lesson
  // -------------------------------------------------------

  for (
    const [
      oldSessionId,
      oldSession,
    ] of videoSessions.entries()
  ) {

    if (
      oldSession.uid === uid &&
      oldSession.lessonId ===
        lessonId
    ) {

      // Every new playback request rotates the token.
      // The previous token becomes invalid immediately.
      videoSessions.delete(
        oldSessionId
      );
    }
  }


  // -------------------------------------------------------
  // Create new session
  // -------------------------------------------------------

  const sessionId =
    crypto
      .randomBytes(32)
      .toString(
        "base64url"
      );


  const session = {

    sessionId,

    uid,

    lessonId,

    ip,

    userAgentHash,

    createdAt:
      now,

    lastSeenAt:
      now,

    expiresAt:
      now +
      VIDEO_SESSION_TTL_MS,

  };


  videoSessions.set(
    sessionId,
    session
  );


  return session;
}


// =========================================================
// VALIDATE PLAYBACK SESSION
// =========================================================

function validateVideoSession(
  req,
  sessionId
) {

  if (
    !sessionId
  ) {

    return {

      valid:
        false,

      reason:
        "missing_session",

    };
  }


  const session =
    videoSessions.get(
      sessionId
    );


  if (
    !session
  ) {

    return {

      valid:
        false,

      reason:
        "session_not_found",

    };
  }


  const now =
    Date.now();


  if (
    session.expiresAt <=
      now
  ) {

    videoSessions.delete(
      sessionId
    );


    return {

      valid:
        false,

      reason:
        "session_expired",

    };
  }

  // Authenticated activity renews the same session.
  session.lastSeenAt = now;
  session.expiresAt = now + VIDEO_SESSION_TTL_MS;
  videoSessions.set(sessionId, session);


  if (
    session.uid !==
    req.user.uid
  ) {

    return {

      valid:
        false,

      reason:
        "session_user_mismatch",

    };
  }


  if (
    session.lessonId !==
    String(
      req.params.lessonId ||
        ""
    )
  ) {

    return {

      valid:
        false,

      reason:
        "session_lesson_mismatch",

    };
  }


  /*
   * We deliberately do NOT permanently bind playback
   * to an IP because mobile networks can change IPs.
   *
   * User-Agent is much safer as a soft binding signal.
   */


  session.lastSeenAt =
    now;

  // IMPORTANT: this is a hard 2-minute expiry.
  // Validation must never extend the lifetime of the token.

  return {

    valid:
      true,

    session,

  };
}


// =========================================================
// LOG VIDEO EVENT
// =========================================================

async function logVideoEvent(
  req,
  event,
  extra = {}
) {

  try {

    const db =
      getDb();


    await db
      .collection(
        "videoAccessLogs"
      )
      .add({

        uid:
          req.user?.uid ||
          null,

        role:
          req.user?.role ||
          null,

        event,

        lessonId:
          req.params?.lessonId ||
          null,

        ip:
          getClientIp(req),

        userAgentHash:
          getUserAgentHash(req),

        createdAt:
          admin.firestore
            .FieldValue
            .serverTimestamp(),

        ...extra,

      });

  } catch (error) {

    /*
     * Logging must never break playback.
     */

    console.error(
      "⚠️ Video access log error:",
      error.message
    );
  }
}


// =========================================================
// VIDEO STATUS
// =========================================================

async function getVideoStatus(
  req,
  res
) {

  try {

    if (
      !req.user ||
      !req.user.uid
    ) {

      return res
        .status(401)
        .json({

          success:
            false,

          error:
            "Unauthorized",

        });
    }


    const rate =
      checkRateLimit(
        req,
        "status"
      );


    if (
      !rate.allowed
    ) {

      await logVideoEvent(
        req,
        "status_rate_limited"
      );


      return res
        .status(429)
        .set(
          "Retry-After",
          String(
            rate.retryAfter
          )
        )
        .json({

          success:
            false,

          error:
            "Too many video status requests",

          retryAfter:
            rate.retryAfter,

        });
    }


    const lessonId =
      String(
        req.params.lessonId ||
          ""
      ).trim();


    if (!lessonId) {

      return res
        .status(400)
        .json({

          success:
            false,

          error:
            "lessonId is required",

        });
    }


    const db =
      getDb();


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

      return res.json({

        success:
          true,

        video: {

          available:
            false,

          provider:
            null,

        },

      });
    }


    const data =
      videoSnap.data() ||
      {};


    const hasYoutube =
      Boolean(
        data.youtubeVideoId
      ) ||
      Boolean(
        data.videoUrl
      );


    await logVideoEvent(
      req,
      hasYoutube
        ? "status_available"
        : "status_empty"
    );


    return res.json({

      success:
        true,

      video: {

        available:
          hasYoutube,

        provider:
          hasYoutube
            ? "youtube"
            : null,

      },

    });

  } catch (error) {

    console.error(
      "❌ Video status error:",
      error
    );


    return res
      .status(500)
      .json({

        success:
          false,

        error:
          error.message ||
          "Video status failed",

      });
  }
}


// =========================================================
// VIDEO ACCESS
// =========================================================

async function getVideoAccess(
  req,
  res
) {

  try {

    if (
      !req.user ||
      !req.user.uid
    ) {

      return res
        .status(401)
        .json({

          success:
            false,

          error:
            "Unauthorized",

        });
    }


    // =====================================================
    // RATE LIMIT
    // =====================================================

    const rate =
      checkRateLimit(
        req,
        "access"
      );


    if (
      !rate.allowed
    ) {

      await logVideoEvent(
        req,
        "access_rate_limited"
      );


      return res
        .status(429)
        .set(
          "Retry-After",
          String(
            rate.retryAfter
          )
        )
        .json({

          success:
            false,

          error:
            "Too many video access requests",

          retryAfter:
            rate.retryAfter,

        });
    }


    // =====================================================
    // LESSON
    // =====================================================

    const lessonId =
      String(
        req.params.lessonId ||
          ""
      ).trim();


    if (!lessonId) {

      return res
        .status(400)
        .json({

          success:
            false,

          error:
            "lessonId is required",

        });
    }


    const db =
      getDb();


    // =====================================================
    // USER
    // =====================================================

    const userSnap =
      await db
        .collection(
          "users"
        )
        .doc(
          String(
            req.user.uid
          )
        )
        .get();


    if (
      !userSnap.exists
    ) {

      await logVideoEvent(
        req,
        "user_not_found"
      );


      return res
        .status(403)
        .json({

          success:
            false,

          error:
            "User account not found",

        });
    }


    const userData =
      userSnap.data() ||
      {};


    const role =
      userData.role ||
      req.user.role ||
      null;


    const isStaff =
      role === "teacher" ||
      role === "admin" ||
      role === "super-admin";


    // =====================================================
    // STUDENT
    // =====================================================

    if (!isStaff) {

      if (
        role !== "student"
      ) {

        await logVideoEvent(
          req,
          "invalid_role"
        );


        return res
          .status(403)
          .json({

            success:
              false,

            error:
              "Student access required",

          });
      }


      if (
        !hasActiveSubscription(
          userData
        )
      ) {

        await logVideoEvent(
          req,
          "subscription_denied"
        );


        return res
          .status(403)
          .json({

            success:
              false,

            error:
              "Active subscription required",

          });
      }
    }


    // =====================================================
    // VIDEO
    // =====================================================

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

      await logVideoEvent(
        req,
        "video_not_found"
      );


      return res
        .status(404)
        .json({

          success:
            false,

          error:
            "Video not found",

        });
    }


    const videoData =
      videoSnap.data() ||
      {};


    // =====================================================
    // YOUTUBE ID
    // =====================================================

    let youtubeVideoId =
      videoData.youtubeVideoId ||
      null;


    if (
      !youtubeVideoId &&
      typeof videoData.videoUrl ===
        "string"
    ) {

      youtubeVideoId =
        extractYoutubeId(
          videoData.videoUrl
        );
    }


    if (!youtubeVideoId) {

      await logVideoEvent(
        req,
        "video_configuration_invalid"
      );


      return res
        .status(404)
        .json({

          success:
            false,

          error:
            "Video configuration is invalid",

        });
    }


    // =====================================================
    // PLAYBACK SESSION
    // =====================================================

    const session =
      createVideoSession(
        req,
        lessonId
      );


    // =====================================================
    // YOUTUBE EMBED
    // =====================================================

    const backendOrigin = getBackendOrigin(req);
    const gateUrl =
      `${backendOrigin}/api/videos/${encodeURIComponent(lessonId)}/gate/${encodeURIComponent(session.sessionId)}`;


    // =====================================================
    // LOG
    // =====================================================

    await logVideoEvent(
      req,
      "playback_granted",
      {

        sessionId:
          session.sessionId,

        sessionExpiresAt:
          new Date(
            session.expiresAt
          ).toISOString(),

      }
    );


    // =====================================================
    // RESPONSE
    // =====================================================

    return res.json({

      success:
        true,

      video: {

        provider:
          "youtube",

        gateUrl,

        // Backward-compatible field for any existing consumer.
        embedUrl: createYoutubeEmbedUrl(req, youtubeVideoId),

        playbackSession: {

          id:
            session.sessionId,

          expiresAt:
            new Date(
              session.expiresAt
            ).toISOString(),

        },

      },

    });

  } catch (error) {

    console.error(
      "❌ Video access error:",
      error
    );


    return res
      .status(500)
      .json({

        success:
          false,

        error:
          error.message ||
          "Video access failed",

      });
  }
}


// =========================================================
// SECURE VIDEO GATE
// =========================================================
// The student receives a short-lived local gate URL instead of
// the raw YouTube URL. The gate embeds YouTube server-side and
// expires itself after the playback token expires.
// =========================================================

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function serveVideoGate(req, res) {
  try {
    const lessonId = String(req.params.lessonId || "").trim();
    const sessionId = String(req.params.sessionId || "").trim();

    if (!lessonId || !sessionId) {
      return res.status(400).send("Invalid video gate");
    }

    const session = videoSessions.get(sessionId);

    if (!session || session.lessonId !== lessonId) {
      return res.status(403).send("Video session is not valid");
    }

    if (session.userAgentHash !== getUserAgentHash(req)) {
      return res.status(403).send("Video session device mismatch");
    }

    const now = Date.now();

    // The 2-minute TTL is only an authorization window.
    // The same session is silently renewed while this Gate is open.
    if (req.query.heartbeat === "1") {
      if (session.expiresAt <= now) {
        videoSessions.delete(sessionId);
        return res.status(403).json({
          success: false,
          valid: false,
          reason: "session_expired",
        });
      }

      session.lastSeenAt = now;
      session.expiresAt = now + VIDEO_SESSION_TTL_MS;
      videoSessions.set(sessionId, session);

      return res.json({
        success: true,
        valid: true,
        expiresAt: new Date(session.expiresAt).toISOString(),
      });
    }

    if (session.expiresAt <= now) {
      videoSessions.delete(sessionId);
      return res.status(403).send("Video session expired");
    }

    const db = getDb();
    const videoSnap = await db.collection("lessonVideos").doc(lessonId).get();

    if (!videoSnap.exists) {
      return res.status(404).send("Video not found");
    }

    const videoData = videoSnap.data() || {};
    const youtubeVideoId = videoData.youtubeVideoId || null;

    if (!youtubeVideoId) {
      return res.status(404).send("Video configuration is invalid");
    }

    const ytUrl = createYoutubeEmbedUrl(req, youtubeVideoId);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader(
      "Content-Security-Policy",
      `default-src 'none'; frame-src https://www.youtube-nocookie.com https://www.youtube.com; script-src 'unsafe-inline'; style-src 'unsafe-inline'; connect-src 'self'; img-src https://i.ytimg.com data:; child-src https://www.youtube-nocookie.com https://www.youtube.com; frame-ancestors ${getFrontendOrigin(req)}`
    );

    return res.send(`<!doctype html>
<html lang="ar">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#000;overflow:hidden">
<iframe id="yt" src="${escapeHtml(ytUrl)}" style="width:100vw;height:100vh;border:0;display:block" allow="accelerometer;autoplay;clipboard-write;encrypted-media;gyroscope;picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe>
<script>
(function(){
  const iframe=document.getElementById('yt');
  const parentOrigin=${JSON.stringify(getFrontendOrigin(req))};
  const sessionId=${JSON.stringify(sessionId)};
  const lessonId=${JSON.stringify(lessonId)};
  let expired=false;

  function send(msg){
    try{ window.parent.postMessage(msg,parentOrigin); }catch(e){}
  }

  async function heartbeat(){
    if(expired) return;

    try{
      const response = await fetch(
        location.pathname + '?heartbeat=1&_=' + Date.now(),
        {
          method:'GET',
          credentials:'same-origin',
          cache:'no-store',
          headers:{'Cache-Control':'no-cache'}
        }
      );

      if(!response.ok){
        if(response.status===403) expire();
        return;
      }

      const data = await response.json();

      if(!data || data.valid !== true) expire();
    }catch(_){
      // Temporary network errors do not stop playback.
      // The next heartbeat will retry.
    }
  }

  function expire(){
    if(expired) return;
    expired=true;

    try{ iframe.src='about:blank'; }catch(_){}

    send({
      type:'MOSTASHAR_VIDEO_EXPIRED',
      lessonId:lessonId,
      sessionId:sessionId
    });

    document.body.innerHTML=
      '<div style="height:100vh;display:flex;align-items:center;justify-content:center;color:#ffd700;font-family:Arial,sans-serif;font-size:18px;text-align:center">انتهت جلسة المشاهدة، جاري إصدار جلسة جديدة...</div>';
  }

  window.addEventListener('message',function(e){
    if(
      e.origin!==parentOrigin &&
      e.origin!=='https://www.youtube-nocookie.com' &&
      e.origin!=='https://www.youtube.com'
    ) return;

    let data=e.data;
    if(typeof data==='string'){
      try{ data=JSON.parse(data); }catch(_){}
    }

    if(
      e.origin===parentOrigin &&
      data &&
      data.type==='MOSTASHAR_YOUTUBE_COMMAND'
    ){
      try{
        iframe.contentWindow.postMessage(
          JSON.stringify({
            event:'command',
            func:data.func,
            args:data.args||[]
          }),
          '*'
        );
      }catch(_){}
      return;
    }

    if(
      (e.origin==='https://www.youtube-nocookie.com' ||
       e.origin==='https://www.youtube.com') &&
      data &&
      data.event==='infoDelivery'
    ){
      send({
        type:'MOSTASHAR_YOUTUBE_EVENT',
        data:data
      });
    }
  });

  iframe.addEventListener('load',function(){
    send({type:'MOSTASHAR_GATE_READY'});
  });

  // Renew before the 2-minute authorization window expires.
  setTimeout(heartbeat, 60 * 1000);
  setInterval(heartbeat, 60 * 1000);
})();
</script>
</body></html>`);
  } catch (error) {
    console.error("❌ serveVideoGate error:", error);
    return res.status(500).send("Video gate failed");
  }
}

// =========================================================
// VALIDATE SESSION
// =========================================================
//
// GET
// /api/videos/:lessonId/session/:sessionId
//
// This endpoint allows the frontend to keep its
// platform-side playback session alive.
//
// IMPORTANT:
//
// This does NOT control the YouTube player itself.
// It controls authorization inside our platform.
// =========================================================

async function validateSession(
  req,
  res
) {

  try {

    if (
      !req.user ||
      !req.user.uid
    ) {

      return res
        .status(401)
        .json({

          success:
            false,

          error:
            "Unauthorized",

        });
    }


    const result =
      validateVideoSession(
        req,
        req.params.sessionId
      );


    if (
      !result.valid
    ) {

      await logVideoEvent(
        req,
        `session_invalid_${result.reason}`
      );


      return res
        .status(403)
        .json({

          success:
            false,

          valid:
            false,

          error:
            "Video session is not valid",

          reason:
            result.reason,

        });
    }


    return res.json({

      success:
        true,

      valid:
        true,

      session: {

        expiresAt:
          new Date(
            result.session.expiresAt
          ).toISOString(),

      },

    });

  } catch (error) {

    console.error(
      "❌ Video session validation error:",
      error
    );


    return res
      .status(500)
      .json({

        success:
          false,

        error:
          error.message ||
          "Session validation failed",

      });
  }
}


// =========================================================
// EXPORTS
// =========================================================

module.exports = {

  getVideoStatus,

  getVideoAccess,

  serveVideoGate,

  validateSession,

  extractYoutubeId,

};