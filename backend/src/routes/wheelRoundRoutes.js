const express = require("express");

const { createWheelRound } = require("../controllers/wheelRoundController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

router.post("/:sessionId/wheel-rounds", createWheelRound);

module.exports = router;
