const { createToken } = require("../services/livekitService")

exports.joinRoom = async (req, res) => {

  try {

    const { userId, lessonId, role } = req.body

    const roomName = `lesson_${lessonId}`

    const token = createToken(userId, roomName, role)

    res.json({
      token,
      roomName
    })

  } catch (err) {

    console.error(err)

    res.status(500).json({
      error: "LiveKit token error"
    })
  }
}