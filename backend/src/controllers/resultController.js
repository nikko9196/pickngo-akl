const {
  findSessionById,
  checkValidParticipant,
} = require("../services/sessionService");
const { getErrorStatus } = require("../utils/errorUtils");

// Submit or update a participant's rating for the final wheel results:
async function submitResultRating(req, res) {
  const sessionId = req.params.sessionId?.trim();
  const { score } = req.body;

  if (!Number.isInteger(score) || score < 1 || score > 5) {
    return res.status(400).json({
      message: "Rating score must be an integer between 1 and 5.",
    });
  }

  try {
    const session = await findSessionById(sessionId);
    checkValidParticipant(session, req.userId);

    if (!session.finalWheelResult?.placeId) {
      return res.status(400).json({
        message: "No final result is available to rate.",
      });
    }

    const existingRating = session.resultRatings.find(
      (rating) => rating.userId.toString() === req.userId,
    );

    if (existingRating) {
      existingRating.score = score;
    } else {
      session.resultRatings.push({
        userId: req.userId,
        score,
      });
    }

    await session.save();

    return res.status(200).json({
      message: "Rating saved.",
      resultRatingSummary: getResultRatingSummary(session),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save rating.";
    return res.status(getErrorStatus(error)).json({ message });
  }
}

// Get a summary of all ratings for the final result:
function getResultRatingSummary(session) {
  const ratings = session.resultRatings || [];

  const averageScore =
    ratings.length > 0
      ? ratings.reduce((total, rating) => total + rating.score, 0) /
        ratings.length
      : null;

  return {
    ratings: ratings.map((rating) => ({
      userId: rating.userId.toString(),
      score: rating.score,
    })),
    ratingCount: ratings.length,
    averageScore,
  };
}

module.exports = {
  submitResultRating,
  getResultRatingSummary,
};
