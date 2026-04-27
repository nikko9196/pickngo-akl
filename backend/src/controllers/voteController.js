const {
  findSessionById,
  checkValidParticipant,
  checkSessionStatus,
} = require("../services/sessionService");

const {
  applyVote,
  calculateVoteResult,
  formatVoteResult,
} = require("../services/voteService");

function getErrorStatus(error) {
  return error.statusCode || 500;
}

// USER VOTE: ACCEPT OR RESPIN:
async function submitVote(req, res) {
  const sessionId = req.params.sessionId?.trim();
  const { vote } = req.body;

  if (!["accept", "respin"].includes(vote)) {
    return res
      .status(400)
      .json({ message: "Vote must be 'accept' or 'respin'." });
  }

  try {
    const session = await findSessionById(sessionId);
    checkValidParticipant(session, req.userId);
    checkSessionStatus(session, "voting");

    const voteSummary = await applyVote(session, req.userId, vote);

    return res.status(200).json({
      voteSummary,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to submit vote.";
    return res.status(getErrorStatus(error)).json({ message });
  }
}

// RESOLVE VOTE: Front-end will call this after the timeout for voting:
async function resolveVote(req, res) {
  const sessionId = req.params.sessionId?.trim();

  try {
    const session = await findSessionById(sessionId);
    checkValidParticipant(session, req.userId);
    checkSessionStatus(session, "voting");

    const result = await calculateVoteResult(session);

    return res.status(200).json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to resolve vote.";
    return res.status(getErrorStatus(error)).json({ message });
  }
}

// GET VOTE RESULT: Front-end uses this to display the current voting state:
async function getVoteResult(req, res) {
  const sessionId = req.params.sessionId?.trim();

  try {
    const session = await findSessionById(sessionId);

    checkValidParticipant(session, req.userId);

    return res.status(200).json(formatVoteResult(session));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch vote result.";
    return res.status(getErrorStatus(error)).json({ message });
  }
}

module.exports = {
  submitVote,
  resolveVote,
  getVoteResult,
};
