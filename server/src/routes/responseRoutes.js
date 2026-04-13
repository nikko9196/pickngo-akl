const express = require("express");

const { upsertResponse } = require("../controllers/responseController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.use(requireAuth);
router.post("/", upsertResponse);

module.exports = router;
