const express = require("express");

const {
  buildWheel,
  spinWheel,
} = require("../controllers/wheelController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

router.post("/:sessionId/wheel/build", buildWheel);
router.post("/:sessionId/wheel/spin", spinWheel);

module.exports = router;
