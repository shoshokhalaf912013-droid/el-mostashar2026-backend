const express = require("express")
const router = express.Router()
const liveController = require("../controllers/liveController")

router.post("/join", liveController.joinRoom)

module.exports = router