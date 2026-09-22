require("dotenv").config()

/* ============================= */
/* EXPRESS APP */
/* ============================= */

const app = require("./app")

/* ============================= */
/* HTTP SERVER */
/* ============================= */

const http = require("http")
const server = http.createServer(app)

/* ============================= */
/* SOCKET.IO */
/* ============================= */

const { Server } = require("socket.io")

const io = new Server(server, {

  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }

})

/* ============================= */
/* SOCKET CONNECTION */
/* ============================= */

io.on("connection", (socket) => {

  console.log("🟢 User Connected:", socket.id)

  /* ============================= */
  /* STUDENT REACTIONS */
  /* ============================= */

  socket.on("reaction", (type) => {

    console.log("⭐ Reaction Received:", type)

    /* send reaction to everyone */

    io.emit("reaction", type)

  })

  /* ============================= */
  /* STUDENT JOIN CLASS */
  /* ============================= */

  socket.on("join-class", (username) => {

    console.log("👨‍🎓 Student Joined:", username)

    io.emit("student-joined", username)

  })

  /* ============================= */
  /* STUDENT LEAVE CLASS */
  /* ============================= */

  socket.on("leave-class", (username) => {

    console.log("🚪 Student Left:", username)

    io.emit("student-left", username)

  })

  /* ============================= */
  /* DISCONNECT */
  /* ============================= */

  socket.on("disconnect", () => {

    console.log("🔴 User Disconnected:", socket.id)

  })

})

/* ============================= */
/* START SERVER */
/* ============================= */

const PORT = process.env.PORT || 5000

server.listen(PORT, "0.0.0.0", () => {

  console.log("🚀 Live Server Running on Port:", PORT)

})