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
const {
  generateSessionRecommendations,
  getLatestSessionRecommendations,
} = require("../controllers/recommendationController");
const {
  getMySessionSelections,
  getSessionSelections,
  saveMySessionSelections,
} = require("../controllers/selectionController");
const { upsertResponse } = require("../controllers/responseController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);
router.get("/mine", getMySessions);
router.get("/:sessionId/progress", getSessionProgress);
router.get("/:sessionId/recommendations/latest", getLatestSessionRecommendations);
router.get("/:sessionId/selections/me", getMySessionSelections);
router.get("/:sessionId/selections", getSessionSelections);
router.get("/code/:sessionCode", getSessionByCode);
router.post("/:sessionId/recommendations", generateSessionRecommendations);
router.post("/:sessionId/responses", upsertResponse);
router.put("/:sessionId/selections/me", saveMySessionSelections);
router.post("/", createSession);
router.post("/join", joinSession);
router.patch("/:sessionId/status", updateSessionStatus);
router.patch("/:sessionId", updateSession);
router.delete("/:sessionId", deleteSession);

module.exports = router;
