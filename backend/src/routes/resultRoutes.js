const express = require("express");

const { submitResultRating } = require("../controllers/resultController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);

router.post("/:sessionId/result/rating", submitResultRating);

module.exports = router;
