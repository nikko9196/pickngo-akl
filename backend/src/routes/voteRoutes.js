const express = require("express");

const { submitVote, resolveVote, getVoteSummary } = require("../controllers/voteController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

router.post("/:sessionId/vote", submitVote);
router.get("/:sessionId/vote", getVoteSummary);
router.post("/:sessionId/vote/result", resolveVote);

module.exports = router;
