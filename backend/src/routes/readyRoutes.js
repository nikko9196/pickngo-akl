const express = require("express");

const {
  markReady,
  sendReminder,
  getReadyStatus,
  markAllReady
} = require("../controllers/readyController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

router.post("/:sessionId/ready", markReady);
router.get("/:sessionId/ready", getReadyStatus);
router.post("/:sessionId/reminder", sendReminder);
router.post("/:sessionId/ready/all", markAllReady);

module.exports = router;
