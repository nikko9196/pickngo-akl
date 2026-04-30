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
  checkIsHost
} = require("../controllers/sessionController");
const {
  generateSessionRecommendations,
  getLatestSessionRecommendations,
} = require("../controllers/recommendationController");
const { upsertResponse } = require("../controllers/responseController");
const { saveUserSelections } = require("../controllers/userSelectionController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);
router.get("/mine", getMySessions);
router.get("/:sessionId/progress", getSessionProgress);
router.get("/:sessionId/recommendations/latest", getLatestSessionRecommendations);
router.get("/code/:sessionCode", getSessionByCode);
router.get("/:sessionId/host", checkIsHost);
router.post("/:sessionId/recommendations", generateSessionRecommendations);
router.post("/:sessionId/responses", upsertResponse);
router.post("/:sessionId/selections", saveUserSelections);
router.post("/", createSession);
router.post("/join", joinSession);
router.patch("/:sessionId/status", updateSessionStatus);
router.patch("/:sessionId", updateSession);
router.delete("/:sessionId", deleteSession);

module.exports = router;
