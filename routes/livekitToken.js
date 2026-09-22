const express = require("express");
const router = express.Router();
const { AccessToken } = require("livekit-server-sdk");

router.get("/token", async (req, res) => {
  try {

    const { room, identity } = req.query;

    if (!room || !identity) {
      return res.status(400).json({
        error: "الغرفة واسم المستخدم مطلوبان"
      });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    const at = new AccessToken(apiKey, apiSecret, {
      identity: identity,
    });

    at.addGrant({
      roomJoin: true,
      room: room,
      canPublish: true,
      canSubscribe: true,
    });

    const token = await at.toJwt();

    res.json({ token });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Token error" });
  }
});

module.exports = router;