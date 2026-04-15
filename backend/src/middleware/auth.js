const jwt = require("jsonwebtoken");

const { JWT_SECRET } = require("../services/authService");

function requireAuth(req, res, next) {
  const authorization = req.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Authentication is required." });
  }

  const token = authorization.slice("Bearer ".length);

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.sub;
    return next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token." });
  }
}

module.exports = {
  requireAuth,
};
