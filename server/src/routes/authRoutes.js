const express = require("express");

const { googleLogin, login, me, register } = require("../controllers/authController");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/google", googleLogin);
router.get("/me", requireAuth, me);

module.exports = router;
