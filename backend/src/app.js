const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const questionRoutes = require("./routes/questionRoutes");
const sessionRoutes = require("./routes/sessionRoutes");
const wheelRoutes = require("./routes/wheelRoutes");
const voteRoutes = require("./routes/voteRoutes");
const readyRoutes = require("./routes/readyRoutes");

const app = express();
const PORT = process.env.PORT || 5001;

connectDB();

app.use(cors());
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/sessions", wheelRoutes);
app.use("/api/sessions", voteRoutes);
app.use("/api/sessions", readyRoutes);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
