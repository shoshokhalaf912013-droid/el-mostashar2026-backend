// setFirebasePassword.js
const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

// ✨ تهيئة Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

async function run() {
  const uid = "VXT6OXiQQFcK3O1wvn7gNTMnZfJ2"; // ضع الـ UID الصحيح
  const newPassword = "3071972"; // كلمة السر الجديدة التي تريدها

  try {
    await admin.auth().updateUser(uid, { password: newPassword });
    console.log("✅ Password updated successfully!");
  } catch (error) {
    console.error("❌ Error updating password:", error);
  }
}

run();
