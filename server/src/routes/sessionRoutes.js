const express = require("express");

const {
  createSession,
  deleteSession,
  getMySessions,
  getSessionProgress,
  getSessionByCode,
  joinSession,
  updateSessionStatus,
  updateMySessionProfile,
  updateSession,
} = require("../controllers/sessionController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);
router.get("/mine", getMySessions);
router.get("/code/:sessionCode", getSessionByCode);
router.get("/:sessionId/progress", getSessionProgress);
router.post("/", createSession);
router.post("/join", joinSession);
router.patch("/:sessionId/me", updateMySessionProfile);
router.patch("/:sessionId/status", updateSessionStatus);
router.patch("/:sessionId", updateSession);
router.delete("/:sessionId", deleteSession);

module.exports = router;
