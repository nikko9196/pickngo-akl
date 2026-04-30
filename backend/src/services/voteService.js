const { getUniquePlaceIds } = require("../utils/wheelUtils");

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

  // CASE 2: RESPIN wins or Vote is tied:
  if (respinCount >= acceptCount) {
    const currentPlaceId = session.currentWheelResult?.placeId;
    const rejectedWheelResult = session.currentWheelResult;

    const uniquePlaceIds = getUniquePlaceIds(session.wheelItems);

    // If only 2 unique restaurants remain, this spin is the final pick.
    if (uniquePlaceIds.length <= 2) {
      session.finalWheelResult = session.currentWheelResult;
      session.status = "completed";

      await session.save();

      return {
        result: "Final spin result is selected.",
        status: session.status,
        finalSpin: true,
        finalWheelResult: session.finalWheelResult,
        voteSummary: session.voteSummary,
      };
    }

    const remainingWheelItems = session.wheelItems.filter(
      (item) => item.placeId !== currentPlaceId,
    );

    const remainingUniquePlaceIds = getUniquePlaceIds(remainingWheelItems);

    session.wheelItems = remainingWheelItems;
    session.currentWheelResult = null;
    session.status = "spinning";

    await session.save();

    return {
      result: "The result is rejected. Spinning the wheel again.",
      status: session.status,
      isNextSpinFinal: remainingUniquePlaceIds.length <= 2,
      rejectedWheelResult,
      remainingUniquePlaceIds,
      voteSummary: session.voteSummary,
    };
  }
  throw new Error("Unexpected vote result state.");
}

module.exports = {
  applyVote,
  calculateVoteResult,
};
