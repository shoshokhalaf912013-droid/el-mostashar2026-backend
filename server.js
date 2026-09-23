// ============================================================
// backend/server.js
// El-Mostashar Backend
// ============================================================


// ==============================
//       INITIAL SETUP
// ==============================

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const fs = require("fs");
const path = require("path");
const http = require("http");
const mongoose = require("mongoose");


// ==============================
//       FIREBASE ADMIN
// ==============================

const admin = require("firebase-admin");

// ------------------------------------------------------------
// FIREBASE SERVICE ACCOUNT
// ------------------------------------------------------------
// Local development:
//   SERVICE_ACCOUNT_KEY points to the JSON file on the PC.
//
// Vercel / production:
//   FIREBASE_SERVICE_ACCOUNT_JSON contains the full service
//   account JSON as an environment variable, so no credential
//   file has to be committed to GitHub.
// ------------------------------------------------------------

let serviceAccount = null;

if (
  process.env.FIREBASE_SERVICE_ACCOUNT_JSON
) {

  try {

    serviceAccount =
      JSON.parse(
        process.env.FIREBASE_SERVICE_ACCOUNT_JSON
      );

    if (
      serviceAccount &&
      typeof serviceAccount.private_key ===
        "string"
    ) {

      serviceAccount.private_key =
        serviceAccount.private_key.replace(
          /\\n/g,
          "\n"
        );
    }

  } catch (error) {

    console.error(
      "❌ Invalid FIREBASE_SERVICE_ACCOUNT_JSON:",
      error.message
    );

    process.exit(1);
  }

} else if (
  process.env.SERVICE_ACCOUNT_KEY
) {

  const serviceAccountPath =
    path.resolve(
      process.env.SERVICE_ACCOUNT_KEY
    );

  if (
    !fs.existsSync(
      serviceAccountPath
    )
  ) {

    console.error(
      "❌ Service Account file not found:",
      serviceAccountPath
    );

    process.exit(1);
  }

  try {

    serviceAccount =
      require(
        serviceAccountPath
      );

  } catch (error) {

    console.error(
      "❌ Could not load Service Account file:",
      error.message
    );

    process.exit(1);
  }

} else {

  console.error(
    "❌ Firebase credentials are not configured. " +
      "Set FIREBASE_SERVICE_ACCOUNT_JSON " +
      "or SERVICE_ACCOUNT_KEY."
  );

  process.exit(1);
}

if (
  !admin.apps.length
) {

  admin.initializeApp({
    credential:
      admin.credential.cert(
        serviceAccount
      ),
  });

}

console.log(
  "🔥 Firebase Admin Connected"
);


// ==============================
//       MONGODB
// ==============================

if (!process.env.MONGO_URL) {

  console.error(
    "❌ MONGO_URL is not defined in .env"
  );

  process.exit(1);
}

// Vercel / serverless-safe connection manager.
// The first request may arrive before the initial connection
// has finished, so all callers share and await the same Promise.
let mongoConnectionPromise = null;

const connectMongo = async () => {

  if (
    mongoose.connection.readyState === 1
  ) {

    return mongoose.connection;
  }

  if (!mongoConnectionPromise) {

    mongoConnectionPromise =
      mongoose
        .connect(
          process.env.MONGO_URL,
          {
            // Atlas/Vercel connectivity can prefer IPv6 on
            // modern Node runtimes; force IPv4 for consistency.
            family: 4,

            // Fail fast enough for a serverless request while
            // still allowing normal Atlas startup latency.
            serverSelectionTimeoutMS: 10000,
            connectTimeoutMS: 10000,

            // Avoid keeping idle connections around forever.
            maxIdleTimeMS: 60000,
          }
        )
        .then(() => {

          console.log(
            "🍃 MongoDB Connected"
          );

          return mongoose.connection;

        })
        .catch((error) => {

          console.error(
            "❌ MongoDB Connection Error:",
            error.message
          );

          // Allow a later invocation to retry cleanly.
          mongoConnectionPromise = null;

          throw error;
        });
  }

  return mongoConnectionPromise;
};

// MongoDB is a startup dependency for all Mongo-backed routes.
// The HTTP server must not accept requests until the initial
// connection has completed successfully.


// ==============================
//         EXPRESS APP
// ==============================

const app = express();


// ==============================
//         MIDDLEWARE
// ==============================

const allowedCorsOrigins = new Set([
  "https://el-mostashar2026.web.app",
  "https://el-mostashar2026.firebaseapp.com",
  "http://localhost:5173",
  "http://localhost:5174",
]);

app.use(
  cors({
    origin: (origin, callback) => {

      if (!origin || allowedCorsOrigins.has(origin)) {
        return callback(null, true);
      }

      return callback(null, false);
    },

    credentials: true,

    methods: [
      "GET",
      "HEAD",
      "POST",
      "PUT",
      "PATCH",
      "DELETE",
      "OPTIONS",
    ],

    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
    ],
  })
);

app.options("*", cors({
  origin: (origin, callback) => {

    if (!origin || allowedCorsOrigins.has(origin)) {
      return callback(null, true);
    }

    return callback(null, false);
  },
  credentials: true,
}));

app.use(
  express.json({
    limit: "10mb",
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb",
  })
);

app.use(
  helmet({
    // The protected video gate is intentionally loaded in an iframe
    // from the production frontend. Allow that frontend to frame the
    // backend gate while keeping framing restricted to our own origins.
    contentSecurityPolicy: {
      directives: {
        frameAncestors: [
          "'self'",
          "https://el-mostashar2026.web.app",
          "https://el-mostashar2026.firebaseapp.com",
        ],
      },
    },

    // X-Frame-Options cannot express a cross-origin allowlist.
    // The CSP frame-ancestors directive above is the modern control.
    xFrameOptions: false,

    crossOriginEmbedderPolicy: false,
  })
);

app.use(
  morgan("dev")
);


// ==============================
//       HTTP SERVER
// ==============================

const server =
  http.createServer(app);


// ==============================
//       SOCKET.IO SERVER
// ==============================

const {
  Server,
} = require("socket.io");

const io =
  new Server(server, {
    cors: {
      origin: "*",
      methods: [
        "GET",
        "POST",
      ],
    },
  });


// ==============================
//      MEMORY BOARD STATE
// ==============================

let boardState = {
  lines: [],
  items: [],
  writer: null,
};


// ==============================
//        SOCKET EVENTS
// ==============================

io.on(
  "connection",
  (socket) => {

    console.log(
      "🟢 User connected:",
      socket.id
    );


    // ==========================
    // SEND BOARD STATE
    // ==========================

    socket.emit(
      "board-state",
      boardState
    );


    // ==========================
    // WHITEBOARD DRAW
    // ==========================

    socket.on(
      "draw",
      (line) => {

        boardState.lines.push(
          line
        );

        socket.broadcast.emit(
          "draw",
          line
        );
      }
    );


    // ==========================
    // CLEAR BOARD
    // ==========================

    socket.on(
      "clear-board",
      () => {

        boardState.lines = [];
        boardState.items = [];

        io.emit(
          "clear-board"
        );
      }
    );


    // ==========================
    // ADD BOARD ITEM
    // image / video / pdf
    // ==========================

    socket.on(
      "board-item",
      (item) => {

        boardState.items.push(
          item
        );

        io.emit(
          "board-item",
          item
        );
      }
    );


    // ==========================
    // MOVE ITEM
    // ==========================

    socket.on(
      "move-item",
      (data) => {

        const item =
          boardState.items.find(
            (i) =>
              i.id === data.id
          );

        if (item) {

          item.x = data.x;
          item.y = data.y;
        }

        socket.broadcast.emit(
          "move-item",
          data
        );
      }
    );


    // ==========================
    // RESIZE ITEM
    // ==========================

    socket.on(
      "resize-item",
      (data) => {

        const item =
          boardState.items.find(
            (i) =>
              i.id === data.id
          );

        if (item) {

          item.width =
            data.width;

          item.height =
            data.height;
        }

        socket.broadcast.emit(
          "resize-item",
          data
        );
      }
    );


    // ==========================
    // PDF PAGE CHANGE
    // ==========================

    socket.on(
      "pdf-page",
      (data) => {

        socket.broadcast.emit(
          "pdf-page",
          data
        );
      }
    );


    // ==========================
    // REACTIONS
    // ==========================

    socket.on(
      "reaction",
      (data) => {

        io.emit(
          "reaction",
          data
        );
      }
    );


    // ==========================
    // SELECT ACTIVE STUDENT
    // ==========================

    socket.on(
      "choose-writer",
      (studentId) => {

        boardState.writer =
          studentId;

        io.emit(
          "writer-changed",
          studentId
        );
      }
    );


    // ==========================
    // DISCONNECT
    // ==========================

    socket.on(
      "disconnect",
      () => {

        console.log(
          "🔴 User disconnected:",
          socket.id
        );
      }
    );
  }
);


// ==============================
//       UPLOADS FOLDER
// ==============================

const uploadsPath =
  path.join(
    __dirname,
    "uploads"
  );

if (
  !fs.existsSync(
    uploadsPath
  )
) {

  fs.mkdirSync(
    uploadsPath,
    {
      recursive: true,
    }
  );

  console.log(
    "📁 uploads folder created"
  );
}

app.use(
  "/uploads",
  express.static(
    uploadsPath
  )
);


// ==============================
//       AUTH MIDDLEWARE
// ==============================

const auth =
  require(
    "./middlewares/auth"
  );


// ==============================
//       REPORT ROUTES
// ==============================

const reportRoutes =
  require(
    "./routes/reportRoutes"
  );


// ==============================
//   STUDENT REPORT ROUTES
// ==============================

const studentReportRoutes =
  require(
    "./routes/studentReportRoutes"
  );


// ==============================
//       PARENT ROUTES
// ==============================

const parentRoutes =
  require(
    "./routes/parentRoutes"
  );


// ==============================
//    ASSIGNMENT ROUTES
// ==============================

const assignmentRoutes =
  require(
    "./routes/assignmentRoutes"
  );


// ==============================
//         AUTH ROUTES
// ==============================

const authRoutes =
  require(
    "./routes/authRoutes"
  );

app.use(
  "/api/auth",
  authRoutes
);


// ==============================
//         EXAM ROUTES
// ==============================

const examRoutes =
  require(
    "./routes/examRoutes"
  );

app.use(
  "/api/exams",
  examRoutes
);


// ==============================
//      QUESTION BANK ROUTES
// ==============================

const questionBankRoutes =
  require(
    "./routes/questionBankRoutes"
  );

app.use(
  "/api/question-bank",
  questionBankRoutes
);


// ==============================
//       ATTEMPT ROUTES
// ==============================

const attemptRoutes =
  require(
    "./routes/attemptRoutes"
  );

/*
  مهم جدًا:

  attemptController.js يعتمد على:
  req.user.id

  لذلك auth يأتي قبل
  attemptRoutes.
*/

app.use(
  "/api/attempts",
  auth,
  attemptRoutes
);


// ==============================
//      STUDENT EXAM ROUTES
// ==============================

const studentExamRoutes =
  require(
    "./routes/studentExamRoutes"
  );

app.use(
  "/api/student/exams",
  studentExamRoutes
);


// ==============================
//          AI ROUTES
// ==============================

const aiRoutes =
  require(
    "./routes/aiRoutes"
  );

app.use(
  "/api/ai",
  aiRoutes
);


// ============================================================
//      PROTECTED VIDEO ROUTES
// ============================================================
//
// Student / Staff playback:
//
// GET
// /api/videos/:lessonId/access
//
// Protected by Firebase Authentication.
//
// ============================================================

const videoRoutes =
  require(
    "./routes/videoRoutes"
  );

app.use(
  "/api/videos",
  videoRoutes
);


// ============================================================
//      VIDEO SECRET ROUTES
//      SUPER ADMIN ONLY
// ============================================================
//
// These routes are for the internal Super Admin area.
//
// GET
//   /api/video-secrets/lessons
//
// GET
//   /api/video-secrets
//
// GET
//   /api/video-secrets/:lessonId
//
// POST
//   /api/video-secrets/:lessonId
//
// DELETE
//   /api/video-secrets/:lessonId
//
// Authentication is applied here.
// The controller itself additionally checks:
// role === "super-admin"
//
// ============================================================

const videoSecretRoutes =
  require(
    "./routes/videoSecretRoutes"
  );

app.use(
  "/api/video-secrets",
  auth,
  videoSecretRoutes
);


// ==============================
//         TEST ROUTE
// ==============================

app.get(
  "/",
  (req, res) => {

    res.json({

      success: true,

      message:
        "🚀 Backend running with Firebase + MongoDB + LiveKit + Socket",

      services: {

        firebase:
          "connected",

        mongodb:
          mongoose.connection
            .readyState === 1
            ? "connected"
            : "connecting",

        socket:
          "enabled",

        livekit:
          "enabled",

        exams:
          "enabled",

        questionBank:
          "enabled",

        authentication:
          "enabled",

      },

    });
  }
);


// ==============================
//       HEALTH CHECK
// ==============================

app.get(
  "/api/health",
  async (req, res) => {

    try {

      await connectMongo();

      return res.json({

        success:
          true,

        server:
          "online",

        mongodb:
          "connected",

        timestamp:
          new Date().toISOString(),

      });

    } catch (error) {

      console.error(
        "❌ Health MongoDB check failed:",
        error.message
      );

      return res.status(503).json({

        success:
          false,

        server:
          "online",

        mongodb:
          "disconnected",

        error:
          error.message,

        timestamp:
          new Date().toISOString(),

      });
    }
  }
);


// ==============================
//         FILE UPLOAD API
// ==============================

const multer =
  require("multer");

const storage =
  multer.diskStorage({

    destination:
      function (
        req,
        file,
        cb
      ) {

        cb(
          null,
          uploadsPath
        );
      },


    filename:
      function (
        req,
        file,
        cb
      ) {

        const uniqueName =
          Date.now() +
          "-" +
          Math.round(
            Math.random() *
              1e9
          );

        cb(
          null,

          uniqueName +
            path.extname(
              file.originalname
            )
        );
      },

  });


const upload =
  multer({

    storage,

    limits: {

      fileSize:
        100 *
        1024 *
        1024,

    },

  });


app.post(
  "/api/upload",

  upload.single(
    "file"
  ),

  (req, res) => {

    try {

      if (!req.file) {

        return res
          .status(400)
          .json({

            success:
              false,

            message:
              "No file uploaded",

          });
      }


      res.json({

        success:
          true,

        fileName:
          req.file
            .filename,

        originalName:
          req.file
            .originalname,

        fileUrl:
          `/uploads/${req.file.filename}`,

        size:
          req.file
            .size,

        mimeType:
          req.file
            .mimetype,

      });

    } catch (error) {

      console.error(
        "Upload error:",
        error
      );

      res
        .status(500)
        .json({

          success:
            false,

          error:
            error.message,

        });
    }
  }
);


// ==============================
//        LIVEKIT TOKEN API
// ==============================

const {
  AccessToken,
} = require(
  "livekit-server-sdk"
);


app.get(
  "/api/live/token",

  async (
    req,
    res
  ) => {

    const {
      room,
      username,
    } = req.query;


    if (
      !room ||
      !username
    ) {

      return res
        .status(400)
        .json({

          success:
            false,

          error:
            "room and username required",

        });
    }


    if (
      !process.env
        .LIVEKIT_API_KEY ||
      !process.env
        .LIVEKIT_API_SECRET ||
      !process.env
        .LIVEKIT_URL
    ) {

      return res
        .status(500)
        .json({

          success:
            false,

          error:
            "LiveKit environment variables are not configured",

        });
    }


    try {

      const at =
        new AccessToken(

          process.env
            .LIVEKIT_API_KEY,

          process.env
            .LIVEKIT_API_SECRET,

          {

            identity:
              String(
                username
              ),

          }

        );


      at.addGrant({

        roomJoin:
          true,

        room:
          String(
            room
          ),

        canPublish:
          true,

        canSubscribe:
          true,

      });


      const token =
        await at.toJwt();


      res.json({

        success:
          true,

        token,

        url:
          process.env
            .LIVEKIT_URL,

      });

    } catch (error) {

      console.error(
        "LiveKit token error:",
        error
      );


      res
        .status(500)
        .json({

          success:
            false,

          error:
            "Token generation failed",

        });
    }
  }
);


// ==============================
//       REPORT ROUTES
// ==============================

/*
  التقارير العامة:

  /api/reports/summary
  /api/reports/students
  /api/reports/students/:userId
  /api/reports/exams
  /api/reports/questions

  كل هذه routes محمية بالـauth.
*/

app.use(
  "/api/reports",
  auth,
  reportRoutes
);


// ==============================
//   STUDENT REPORT ROUTES
// ==============================

/*
  التقرير الكامل للطالب:

  GET
  /api/student-reports/:userId

  مخصص حاليًا للـstaff
  حسب controller.
*/

app.use(
  "/api/student-reports",
  auth,
  studentReportRoutes
);


// ==============================
//       PARENT ROUTES
// ==============================

/*
  ولي الأمر:

  GET
  /api/parents/children

  GET
  /api/parents/children/:studentId/report
*/

app.use(
  "/api/parents",
  auth,
  parentRoutes
);


// ==============================
//    ASSIGNMENT ROUTES
// ==============================

/*
  الواجبات:

  GET
  /api/assignments

  POST
  /api/assignments

  GET
  /api/assignments/:id

  POST
  /api/assignments/:id/submit

  POST
  /api/assignments/:id/grade

  PUT
  /api/assignments/:id

  DELETE
  /api/assignments/:id
*/

app.use(
  "/api/assignments",
  auth,
  assignmentRoutes
);


// ==============================
//       404 HANDLER
// ==============================

app.use(
  (req, res) => {

    res
      .status(404)
      .json({

        success:
          false,

        error:
          "Route not found",

        path:
          req.originalUrl,

      });
  }
);


// ==============================
//       GLOBAL ERROR HANDLER
// ==============================

app.use(
  (
    err,
    req,
    res,
    next
  ) => {

    console.error(
      "❌ Server Error:",
      err
    );


    if (
      res.headersSent
    ) {

      return next(
        err
      );
    }


    res
      .status(
        err.status ||
          500
      )
      .json({

        success:
          false,

        error:
          err.message ||
          "Internal server error",

      });
  }
);


// ==============================
//         START SERVER
// ==============================

const PORT =
  process.env.PORT ||
  5000;


const startServer = async () => {

  try {

    // Do not start accepting HTTP requests until MongoDB is ready.
    await connectMongo();

    server.listen(
      PORT,
      "0.0.0.0",
      () => {

        console.log(
          `🚀 Server running on port ${PORT}`
        );

        console.log(
          "📡 Socket.IO enabled"
        );

        console.log(
          "🎥 LiveKit enabled"
        );

        console.log(
          "📝 Exam system enabled"
        );

        console.log(
          "📚 Question Bank enabled"
        );

        console.log(
          "🔐 Authentication enabled"
        );

        console.log(
          "🔒 Protected Video API enabled"
        );

      }
    );

  } catch (error) {

    console.error(
      "❌ Server startup aborted because MongoDB is unavailable:",
      error.message
    );

    process.exit(1);
  }
};

startServer();