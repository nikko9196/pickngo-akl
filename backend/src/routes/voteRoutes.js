const express = require("express");

const { submitVote, resolveVote, getVoteResult } = require("../controllers/voteController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

router.post("/:sessionId/vote", submitVote);
router.post("/:sessionId/vote/result", resolveVote);
router.get("/:sessionId/vote/result", getVoteResult);

module.exports = router;
