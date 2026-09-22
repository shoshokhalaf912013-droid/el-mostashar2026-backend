const { AccessToken } = require("livekit-server-sdk")
const { LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = require("../config/livekit")

function createToken(identity, room, role) {

  const at = new AccessToken(
    LIVEKIT_API_KEY,
    LIVEKIT_API_SECRET,
    {
      identity: identity
    }
  )

  at.addGrant({
    roomJoin: true,
    room: room,
    canPublish: role !== "student",
    canSubscribe: true
  })

  return at.toJwt()
}

module.exports = {
  createToken
}