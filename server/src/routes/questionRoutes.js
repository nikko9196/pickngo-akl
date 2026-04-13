const express = require("express");

const { getActiveQuestionLists } = require("../controllers/questionController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);
router.get("/active", getActiveQuestionLists);

module.exports = router;
