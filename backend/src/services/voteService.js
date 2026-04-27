function resetVoteSummary() {
  return {
    acceptCount: 0,
    respinCount: 0,
    votedUserIds: [],
  };
}

async function applyVote(session, userId, vote) {
  if (session.voteSummary.votedUserIds.includes(userId)) {
    const error = new Error("You have already voted.");
    error.statusCode = 400;
    throw error;
  }

  // After validation, update the vote:
  if (vote === "accept") {
    session.voteSummary.acceptCount += 1;
  } else {
    session.voteSummary.respinCount += 1;
  }

  session.voteSummary.votedUserIds.push(userId);

  await session.save();

  return session.voteSummary;
}

async function calculateVoteResult(session) {
  if (!session.currentWheelResult?.placeId) {
    const error = new Error("No wheel result is available to vote on.");
    error.statusCode = 400;
    throw error;
  }

  const { acceptCount, respinCount } = session.voteSummary;

  // CASE 1: ACCEPT wins:
  if (acceptCount > respinCount) {
    session.finalWheelResult = session.currentWheelResult;
    session.status = "completed";
    await session.save();

    return {
      result: "The wheel result is accepted.",
      status: session.status,
      finalWheelResult: session.finalWheelResult,
      voteSummary: session.voteSummary,
    };
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

      return {
        result: "No items left in the wheel.",
      };
    }

    const rejectedWheelResult = session.currentWheelResult;

    session.currentWheelResult = null;
    session.status = "spinning";

    await session.save();

    return {
      result: "The result is rejected. Spinning the wheel again.",
      status: session.status,
      rejectedWheelResult,
      voteSummary: session.voteSummary,
    };
  }

  // CASE 3: Tie or no one votes, restart voting:
  const previousVoteSummary = {
    acceptCount: session.voteSummary.acceptCount,
    respinCount: session.voteSummary.respinCount,
    votedUserIds: [...session.voteSummary.votedUserIds],
  };

  session.voteSummary = resetVoteSummary();
  session.status = "voting";

  await session.save();

  return {
    result: "The vote resulted in a tie or no votes were submitted.",
    status: session.status,
    voteSummary: previousVoteSummary,
  };
}

module.exports = {
  applyVote,
  calculateVoteResult,
};
