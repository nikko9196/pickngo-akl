const UserSelection = require("../models/UserSelection");

const {
  findSessionById,
  checkValidParticipant,
} = require("../services/sessionService");

function getErrorStatus(error) {
  return error.statusCode || 500;
}

async function buildWheel(req, res) {
  const sessionId = req.params.sessionId?.trim();

  try {
    const session = await findSessionById(sessionId);
    checkValidParticipant(session, req.userId);

    const userSelections = await UserSelection.find({ sessionId });

    if (!userSelections.length) {
      return res.status(404).json({
        message:
          "No user selections found for this session to build the wheel.",
      });
    }

    const wheelItems = userSelections.flatMap((selection) =>
      selection.selectedItems.map((item) => ({
        recommendationSetId: selection.recommendationSetId,
        placeId: item.placeId,
      })),
    );

    if (!wheelItems.length) {
      return res.status(400).json({
        message:
          "No wheel items available for this session to build the wheel.",
      });
    }

    const maxPossibleWheelItems =
      session.participants.length * session.maxSelectionsPerUser;

    if (wheelItems.length > maxPossibleWheelItems) {
      return res.status(400).json({
        message:
          "Wheel items exceed the maximum allowed selections for this session.",
      });
    }

    session.wheelItems = wheelItems;
    session.status = "spinning";
    session.currentWheelResult = null;
    session.finalWheelResult = null;
    session.voteSummary = {
      acceptCount: 0,
      respinCount: 0,
      votedUserIds: [],
    };

    await session.save();

    return res.status(200).json({
      session: {
        id: session._id.toString(),
        wheelItems: session.wheelItems,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to build the wheel.";
    return res.status(getErrorStatus(error)).json({ message });
  }
}

async function spinWheel(req, res) {
  const sessionId = req.params.sessionId?.trim();

  try {
    const session = await findSessionById(sessionId);

    if (session.hostUserId.toString() !== req.userId) {
      return res
        .status(403)
        .json({ message: "Only the host can spin the wheel." });
    }

    if (!session.wheelItems || !session.wheelItems.length) {
      return res.status(400).json({
        message: "No wheel items available to spin.",
      });
    }

    if (session.status === "voting") {
      return res.status(400).json({
        message: "Wheel has already been spun.",
      });
    }

    const randomIndex = Math.floor(Math.random() * session.wheelItems.length);

    const selectedItem = session.wheelItems[randomIndex];

    session.currentWheelResult = {
      recommendationSetId: selectedItem.recommendationSetId,
      placeId: selectedItem.placeId,
    };

    session.status = "voting";

    session.voteSummary = {
      acceptCount: 0,
      respinCount: 0,
      votedUserIds: [],
    };

    await session.save();

    return res.status(200).json({
      session: {
        id: session._id.toString(),
        currentWheelResult: session.currentWheelResult,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to spin the wheel.";
    return res.status(getErrorStatus(error)).json({ message });
  }
}

module.exports = {
  buildWheel,
  spinWheel,
};
