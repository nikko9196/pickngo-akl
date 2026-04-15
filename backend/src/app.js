import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";
import { initSocket } from './socket/socketHandler.js';

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Test route
app.get("/", (req, res) => {
  res.send("API is running...");
});

const PORT = process.env.PORT


import userdecision from './mock-api/userdecisionRoutes.js';
app.use('/api/decision', userdecision);

import userhost from './mock-api/userRoutes.js';
app.use('/api/host', userhost);

// socket.io logic

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});

initSocket(io);

// app.listen(PORT, () => {
//   console.log(`Server running on port ${PORT}`);
// });
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });