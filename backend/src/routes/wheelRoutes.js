const express = require("express");

const {
  buildWheel,
  spinWheel,
  getCurrentWheel,
  getWheelState,
  getFinalWheelResult,
} = require("../controllers/wheelController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

router.post("/:sessionId/wheel/build", buildWheel);
router.get("/:sessionId/wheel/result", getFinalWheelResult);
router.get("/:sessionId/wheel/state", getWheelState);
router.get("/:sessionId/wheel", getCurrentWheel);
router.post("/:sessionId/wheel/spin", spinWheel);

module.exports = router;
