// backend/functions/index.js
const functions = require("firebase-functions");
const axios = require("axios");

exports.sendWhatsapp = functions.https.onRequest(async (req, res) => {
  try {
    const { phone, message } = req.body;
    // تأكد أنك تضع رقم الهاتف مع كود الدولة بدون "+"
    // مثال لمصر: 2010xxxxxxx
    const WAPP_NUMBER_ID = "YOUR_WHATSAPP_NUMBER_ID";
    const TOKEN = "YOUR_WHATSAPP_TOKEN";

    await axios.post(
      `https://graph.facebook.com/v17.0/${WAPP_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: phone,
        text: { body: message }
      },
      { headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" } }
    );

    res.json({ ok: true });
  } catch (err) {
    console.error(err.response?.data || err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});
