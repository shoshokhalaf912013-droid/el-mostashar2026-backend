import express from "express"
import { createLiveKitToken } from "../services/livekitService.js"

const router = express.Router()

router.post("/join", async (req, res) => {

  const { userId, lessonId, role } = req.body

  const roomName = `lesson_${lessonId}`

  const token = createLiveKitToken(userId, roomName, role)

  res.json({
    token,
    roomName
  })
})

export default router