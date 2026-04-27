const Session = require("../models/Session");

function resetVoteSummary() {
  return {
    acceptCount: 0,
    respinCount: 0,
    votedUserIds: [],
  };
}

// USER VOTE: ACCEPT OR RESPIN:
async function submitVote(req, res) {
  const sessionId = req.params.sessionId?.trim();
  const { vote } = req.body;

  if (!sessionId) {
    return res.status(400).json({ message: "Session ID is required." });
  }

  if (!["accept", "respin"].includes(vote)) {
    return res
      .status(400)
      .json({ message: "Vote must be 'accept' or 'respin'." });
  }

  try {
    const session = await Session.findById(sessionId);

    if (!session) {
      return res.status(404).json({ message: "Session not found." });
    }

    const isParticipant = session.participants.some(
      (p) => p.userId.toString() === req.userId,
    );

    if (!isParticipant) {
      return res
        .status(403)
        .json({ message: "You are not a participant in this session." });
    }

    if (session.status !== "voting") {
      return res
        .status(400)
        .json({ message: "Session is not in voting state." });
    }

    if (session.voteSummary.votedUserIds.includes(req.userId)) {
      return res.status(400).json({ message: "You have already voted." });
    }

    // After validation, update the vote:
    if (vote === "accept") {
      session.voteSummary.acceptCount += 1;
    } else {
      session.voteSummary.respinCount += 1;
    }

    session.voteSummary.votedUserIds.push(req.userId);

    await session.save();

    return res.status(200).json({
      voteSummary: session.voteSummary,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to submit vote.";
    return res.status(500).json({ message });
  }
}

// RESOLVE VOTE: Front-end will call this after the timeout for voting:
async function resolveVote(req, res) {
  const sessionId = req.params.sessionId?.trim();

  if (!sessionId) {
    return res.status(400).json({ message: "Session ID is required." });
  }

  try {
    const session = await Session.findById(sessionId);

    if (!session) {
      return res.status(404).json({ message: "Session not found." });
    }

    const isParticipant = session.participants.some(
      (p) => p.userId.toString() === req.userId,
    );

    if (!isParticipant) {
      return res
        .status(403)
        .json({ message: "You are not a participant in this session." });
    }

    if (session.status !== "voting") {
      return res
        .status(400)
        .json({ message: "Session is not in voting state." });
    }

    if (!session.currentWheelResult?.placeId) {
      return res.status(400).json({
        message: "No wheel result is available to vote on.",
      });
    }

    const { acceptCount, respinCount } = session.voteSummary;

    // CASE 1: ACCEPT wins:
    if (acceptCount > respinCount) {
      session.finalWheelResult = session.currentWheelResult;
      session.status = "completed";
      await session.save();

      return res.status(200).json({
        result: "The wheel result is accepted.",
        finalWheelResult: session.finalWheelResult,
      });
    }

    // CASE 2: RESPIN wins:
    if (respinCount > acceptCount) {
      const currentPlaceId = session.currentWheelResult?.placeId;

      // Remove the currentWheelResult from wheelItems (including duplication on the wheel) to avoid it being selected again:
      session.wheelItems = session.wheelItems.filter(
        (item) => item.placeId !== currentPlaceId,
      );

      // Edge case: If no items left: 
      // NOTE: This should be considered as what happens if the wheel items are out of after voting?
      if (!session.wheelItems.length) {
        session.status = "completed";
        session.finalWheelResult = null;
        await session.save();

        return res.status(200).json({
          result: "No items left in the wheel.",
        });
      }

      session.currentWheelResult = null;
      session.voteSummary = resetVoteSummary();
      session.status = "spinning";

      await session.save();

      return res.status(200).json({
        result: "The result is rejected. Spinning the wheel again.",
      });
    }

    // CASE 3: Tie or no one votes, restart voting:
    session.voteSummary = resetVoteSummary();
    session.status = "voting";

    await session.save();

    return res.status(200).json({
      result: "The vote resulted in a tie or no votes were submitted.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to resolve vote.";
    return res.status(500).json({ message });
  }
}

// GET VOTE RESULT: Front-end uses this to display the current voting state:
async function getVoteResult(req, res) {
  const sessionId = req.params.sessionId?.trim();

  if (!sessionId) {
    return res.status(400).json({ message: "Session ID is required." });
  }

  try {
    const session = await Session.findById(sessionId);

    if (!session) {
      return res.status(404).json({ message: "Session not found." });
    }

    const isParticipant = session.participants.some(
      (p) => p.userId.toString() === req.userId,
    );

    if (!isParticipant) {
      return res
        .status(403)
        .json({ message: "You are not a participant in this session." });
    }

    return res.status(200).json({
      sessionId: session._id.toString(),
      status: session.status,
      currentWheelResult: session.currentWheelResult,
      finalWheelResult: session.finalWheelResult,
      voteSummary: session.voteSummary,
      totalParticipants: session.participants.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch vote result.";
    return res.status(500).json({ message });
  }
}

module.exports = {
  submitVote,
  resolveVote,
  getVoteResult,
};
