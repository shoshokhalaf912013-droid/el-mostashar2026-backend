// =========================================================
// backend/middlewares/auth.js
// =========================================================

const jwt = require("jsonwebtoken");
const admin = require("firebase-admin");

const {
  getFirestore,
} = require("firebase-admin/firestore");


// =========================================================
// FIRESTORE DATABASE
// =========================================================
//
// IMPORTANT:
//
// The platform uses the named Firestore database:
//
//     el-mostashar2026
//
// Therefore we explicitly connect to that database.
// =========================================================

function getDb() {

  if (
    !admin.apps ||
    admin.apps.length === 0
  ) {

    throw new Error(
      "Firebase Admin is not initialized"
    );
  }

  return getFirestore(
    admin.app(),
    "el-mostashar2026"
  );
}


// =========================================================
// GET BEARER TOKEN
// =========================================================

function getBearerToken(req) {

  const authorization =
    req.header(
      "Authorization"
    );

  if (!authorization) {
    return null;
  }

  if (
    typeof authorization !==
    "string"
  ) {
    return null;
  }

  if (
    authorization
      .toLowerCase()
      .startsWith("bearer ")
  ) {

    return authorization
      .slice(7)
      .trim();
  }

  return authorization.trim();
}


// =========================================================
// FIREBASE AUTH
// =========================================================

async function verifyFirebaseToken(
  token
) {

  if (
    !admin.apps ||
    admin.apps.length === 0
  ) {

    throw new Error(
      "Firebase Admin is not initialized"
    );
  }

  const decodedToken =
    await admin
      .auth()
      .verifyIdToken(
        token
      );

  return decodedToken;
}


// =========================================================
// FIRESTORE USER ROLE
// =========================================================

async function getUserRole(
  uid
) {

  try {

    const db =
      getDb();

    const userRef =
      db
        .collection(
          "users"
        )
        .doc(
          String(uid)
        );

    const userSnap =
      await userRef.get();

    if (
      !userSnap.exists
    ) {

      console.warn(
        "⚠️ User document not found:",
        String(uid),
        "in database: el-mostashar2026"
      );

      return null;
    }

    const userData =
      userSnap.data() ||
      {};

    const role =
      typeof userData.role ===
      "string"
        ? userData.role.trim()
        : null;

    console.log(
      "🔐 Backend user role:",
      {
        uid:
          String(uid),

        role,

        database:
          "el-mostashar2026",
      }
    );

    return role;

  } catch (error) {

    console.error(
      "⚠️ Failed to load user role from Firestore:",
      error.message
    );

    return null;
  }
}


// =========================================================
// FIRESTORE USER DATA
// =========================================================
//
// This helper is useful for future protected endpoints.
// =========================================================

async function getUserData(
  uid
) {

  try {

    const db =
      getDb();

    const userSnap =
      await db
        .collection(
          "users"
        )
        .doc(
          String(uid)
        )
        .get();

    if (
      !userSnap.exists
    ) {

      return null;
    }

    return (
      userSnap.data() ||
      {}
    );

  } catch (error) {

    console.error(
      "⚠️ Failed to load Firestore user data:",
      error.message
    );

    return null;
  }
}


// =========================================================
// JWT FALLBACK
// =========================================================

function verifyLegacyJWT(
  token
) {

  const secret =
    process.env.JWT_SECRET ||
    "dev_secret";

  return jwt.verify(
    token,
    secret
  );
}


// =========================================================
// MAIN AUTH MIDDLEWARE
// =========================================================

module.exports =
  async function (
    req,
    res,
    next
  ) {

    try {

      // ===================================================
      // TOKEN
      // ===================================================

      const token =
        getBearerToken(
          req
        );

      if (!token) {

        return res
          .status(401)
          .json({

            success:
              false,

            msg:
              "No token provided",

            error:
              "No authorization token provided",

          });
      }


      // ===================================================
      // TRY FIREBASE FIRST
      // ===================================================

      try {

        const firebaseUser =
          await verifyFirebaseToken(
            token
          );

        /*
        Firebase decoded token contains:

        uid
        email
        name
        picture
        aud
        iss
        auth_time
        user_id
        etc.
        */

        const uid =
          firebaseUser.uid;


        // =================================================
        // FIRESTORE ROLE
        // =================================================

        const firestoreRole =
          await getUserRole(
            uid
          );


        // =================================================
        // FIRESTORE USER DATA
        // =================================================

        const firestoreUser =
          await getUserData(
            uid
          );


        /*
        ---------------------------------------------------
        ROLE PRIORITY
        ---------------------------------------------------

        1. Firestore role
        2. Firebase custom claim role
        3. null

        We intentionally DO NOT trust a role sent
        by the browser.
        ---------------------------------------------------
        */

        const role =
          firestoreRole ||
          firebaseUser.role ||
          null;


        // =================================================
        // REQUEST USER
        // =================================================

        req.user = {

          ...firebaseUser,

          id:
            uid,

          uid:
            uid,

          userId:
            uid,

          role,

          /*
           * Keep user information available internally.
           */

          firestoreUser:
            firestoreUser ||
            null,

        };


        // =================================================
        // AUTH DEBUG
        // =================================================

        console.log(
          "✅ Firebase authentication successful:",
          {
            uid:
              uid,

            email:
              firebaseUser.email ||
              null,

            role:
              role,

            firestoreUserFound:
              Boolean(
                firestoreUser
              ),
          }
        );


        return next();

      } catch (
        firebaseError
      ) {

        /*
        ---------------------------------------------------
        Firebase verification failed.
        Try legacy JWT.
        ---------------------------------------------------
        */

        console.warn(
          "⚠️ Firebase token verification failed. Trying legacy JWT...",
          firebaseError.message
        );
      }


      // ===================================================
      // TRY LEGACY JWT
      // ===================================================

      try {

        const decoded =
          verifyLegacyJWT(
            token
          );

        const id =
          decoded.id ||
          decoded.uid ||
          decoded.userId ||
          null;


        req.user = {

          ...decoded,

          id,

          uid:
            decoded.uid ||
            decoded.id ||
            decoded.userId ||
            null,

          userId:
            decoded.userId ||
            decoded.id ||
            decoded.uid ||
            null,

          role:
            decoded.role ||
            null,

        };


        console.log(
          "✅ Legacy JWT authentication successful:",
          {
            id:
              req.user.id,

            role:
              req.user.role ||
              null,
          }
        );


        return next();

      } catch (
        jwtError
      ) {

        console.error(
          "❌ Authentication failed:",
          jwtError.message
        );


        return res
          .status(401)
          .json({

            success:
              false,

            msg:
              "Invalid token",

            error:
              "Invalid or expired authentication token",

          });
      }

    } catch (
      error
    ) {

      console.error(
        "❌ Auth middleware error:",
        error
      );


      return res
        .status(500)
        .json({

          success:
            false,

          msg:
            "Authentication server error",

          error:
            error.message ||
            "Authentication failed",

        });
    }
  };


// =========================================================
// OPTIONAL EXPORTS
// =========================================================
//
// These do not affect the existing middleware usage.
// =========================================================

module.exports.getUserRole =
  getUserRole;

module.exports.getUserData =
  getUserData;