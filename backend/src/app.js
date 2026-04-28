const express = require("express");
const cors = require("cors");

// socket.io libraries
const http = require("http");
const { Server } = require("socket.io");

require("dotenv").config();

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");
const questionRoutes = require("./routes/questionRoutes");
const sessionRoutes = require("./routes/sessionRoutes");
const wheelRoutes = require("./routes/wheelRoutes");
const voteRoutes = require("./routes/voteRoutes");

// --- Paige test ----
// const userdecision = require("./mock-api/userdecisionRoutes");
// const userhost = require("./mock-api/userRoutes");
// -------

// initSocket
const { initSocket } = require("./socket/socketHandler");

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

// --- Paige test ----
// app.use('/api/decision', userdecision);
// app.use('/api/host', userhost);
// -------


// --- init socket.io ---
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});
initSocket(io);
// ----

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
}); 
