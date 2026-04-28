const {
  generateRecommendationsForSession,
  getLatestRecommendationsForSession,
} = require("../services/recommendationService");

function parseRefreshFlag(rawValue) {
  if (typeof rawValue !== "string") {
    return false;
  }

  return ["1", "true", "yes"].includes(rawValue.trim().toLowerCase());
}

function handleControllerError(error, res, fallbackMessage) {
  const statusCode = Number.isInteger(error?.statusCode) ? error.statusCode : 500;
  const message = error?.message || fallbackMessage;

  return res.status(statusCode).json({ message });
}

async function generateSessionRecommendations(req, res) {
  try {
    const result = await generateRecommendationsForSession({
      sessionId: req.params.sessionId,
      requesterUserId: req.userId,
      refresh: parseRefreshFlag(req.query.refresh),
    });

    return res.status(result.cached ? 200 : 201).json(result);
  } catch (error) {
    return handleControllerError(
      error,
      res,
      "Failed to generate room recommendations."
    );
  }
}

async function getLatestSessionRecommendations(req, res) {
  try {
    const result = await getLatestRecommendationsForSession({
      sessionId: req.params.sessionId,
      requesterUserId: req.userId,
    });

    return res.json(result);
  } catch (error) {
    return handleControllerError(
      error,
      res,
      "Failed to fetch room recommendations."
    );
  }
}

module.exports = {
  generateSessionRecommendations,
  getLatestSessionRecommendations,
};
