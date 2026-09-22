router.post("/login", async (req, res) => {
  const { email, password } = req.body;

  try {
    // تسجيل الدخول من الفايربيز
    const userRecord = await signInWithEmailAndPassword(auth, email, password);
    const uid = userRecord.user.uid;

    // قراءة بيانات المستخدم من Firestore
    const userRef = doc(db, "users", uid);
    const snap = await getDoc(userRef);

    let role = "student"; // الدور الافتراضي للكل

    if (snap.exists()) {
      role = snap.data().role || "student";
    }

    // 🔥 إجبارياً: هذا الإيميل دائماً Super Admin
    if (email === "khalafmahrous2000@gmail.com") {
      role = "superAdmin";
    }

    const token = jwt.sign(
      { uid, email, role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      message: "Login success",
      token,
      role
    });

  } catch (err) {
    console.log("Login error:", err);
    res.status(401).json({ message: "Invalid credentials" });
  }
});
