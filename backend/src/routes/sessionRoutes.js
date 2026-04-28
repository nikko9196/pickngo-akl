const express = require("express");

const {
  createSession,
  deleteSession,
  getMySessions,
  getSessionProgress,
  getSessionByCode,
  joinSession,
  updateSessionStatus,
  updateSession,
} = require("../controllers/sessionController");
const { upsertResponse } = require("../controllers/responseController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);
router.get("/mine", getMySessions);
router.get("/:sessionId/progress", getSessionProgress);
router.get("/code/:sessionCode", getSessionByCode);
router.post("/:sessionId/responses", upsertResponse);
router.post("/", createSession);
router.post("/join", joinSession);
router.patch("/:sessionId/status", updateSessionStatus);
router.patch("/:sessionId", updateSession);
router.delete("/:sessionId", deleteSession);

module.exports = router;
