const express = require("express");
const cors = require("cors");
require("dotenv").config();

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const questionRoutes = require("./routes/questionRoutes");
const responseRoutes = require("./routes/responseRoutes");
const sessionRoutes = require("./routes/sessionRoutes");

const app = express();
const PORT = process.env.PORT || 5001;

connectDB();

app.use(cors());
app.use(express.json());

// test route
app.get("/", (req, res) => {
    res.send("Backend is running!");
});

app.get("/api/health", (req, res) => {
    res.json({ status: "OK" });
});

app.use("/api/auth", authRoutes);
app.use("/api/questions", questionRoutes);
app.use("/api/responses", responseRoutes);
app.use("/api/sessions", sessionRoutes);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
