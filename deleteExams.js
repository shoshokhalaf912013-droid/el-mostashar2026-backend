const mongoose = require("mongoose");
const Exam = require("./models/Exam");

const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017/elmostashar";

mongoose.connect(MONGO_URL)
  .then(async () => {
    console.log("Connected to MongoDB");

    const result = await Exam.deleteMany({});
    console.log("Deleted exams:", result);

    mongoose.connection.close();
  })
  .catch(err => console.error(err));
