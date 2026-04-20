const express = require("express");

const {
  createWheelRound,
  spinWheelRound,
} = require("../controllers/wheelRoundController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

router.post("/:sessionId/wheel-rounds", createWheelRound);
router.post("/:sessionId/wheel-rounds/:wheelRoundId/spin", spinWheelRound);

module.exports = router;
