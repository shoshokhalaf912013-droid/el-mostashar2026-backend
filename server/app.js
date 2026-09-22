const express = require("express");
const cors = require("cors");

const liveRoutes = require("./routes/liveRoutes");
const reportRoutes = require("./routes/reportRoutes");

const auth = require("./middlewares/auth");

const app = express();

/* =========================================================
   GLOBAL MIDDLEWARE
========================================================= */

app.use(cors());

app.use(express.json());

/* =========================================================
   LIVE
========================================================= */

app.use(
  "/api/live",
  liveRoutes
);

/* =========================================================
   REPORTS
========================================================= */

app.use(
  "/api/reports",
  auth,
  reportRoutes
);

module.exports = app;