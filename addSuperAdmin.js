const admin = require("firebase-admin");
const serviceAccount = require("./serviceAccountKey.json");

// ========== ضع الباسورد اللي تريده هنا ==========
const CUSTOM_PASSWORD = "YourStrongPassword123"; 
// ===============================================

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const email = "khalafmahrous2000@gmail.com";

admin
  .auth()
  .createUser({
    email: email,
    password: CUSTOM_PASSWORD
  })
  .then((userRecord) => {
    console.log("✔️ Super Admin created:", userRecord.uid);

    return admin.firestore()
      .collection("users")
      .doc(userRecord.uid)
      .set({
        email: email,
        role: "superadmin",
        createdAt: new Date(),
      });
  })
  .then(() => {
    console.log("✔️ Super Admin saved to Firestore");
  })
  .catch((error) => {
    if (error.code === "auth/email-already-exists") {
      console.log("⚠️ Email exists… updating Firestore role only");

      return admin
        .auth()
        .getUserByEmail(email)
        .then((userRecord) => {
          return admin.firestore()
            .collection("users")
            .doc(userRecord.uid)
            .set(
              {
                email: email,
                role: "superadmin",
                updatedAt: new Date(),
              },
              { merge: true }
            );
        })
        .then(() => console.log("✔️ Role updated to superadmin"));
    }

    console.error("❌ Error:", error);
  });
