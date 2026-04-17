const Session = require("../models/Session");
const UserSelection = require("../models/UserSelection");
const WheelRound = require("../models/WheelRound");

function serialiseWheelRound(wheelRound) {
  return {
    id: wheelRound._id.toString(),
    sessionId: wheelRound.sessionId,
    wheelItems: wheelRound.wheelItems.map((item) => ({
      recommendationSetId: item.recommendationSetId,
      placeId: item.placeId,
    })),
    resultPlaceId: wheelRound.resultPlaceId,
    status: wheelRound.status,
    createdAt: wheelRound.createdAt,
  };
}

async function createWheelRound(req, res) {
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
      (participant) => participant.userId.toString() === req.userId,
    );

    if (!isParticipant) {
      return res
        .status(403)
        .json({ message: "You are not a participant in this session." });
    }

    const userSelections = await UserSelection.find({ sessionId });

    if (!userSelections.length) {
      return res
        .status(404)
        .json({ message: "No user selections found for this session to build the wheel." });
    }

    const wheelItems = userSelections.flatMap((selection) =>
      selection.selectedItems.map((item) => ({
        recommendationSetId: selection.recommendationSetId,
        placeId: item.placeId,
      })),
    );

    if (!wheelItems.length) {
      return res
        .status(400)
        .json({ message: "No wheel items available for this session to build the wheel." });
    }

    const maxPossibleWheelItems =
      session.participants.length * session.maxSelectionsPerUser;

    if (wheelItems.length > maxPossibleWheelItems) {
      return res.status(400).json({
        message:
          "Wheel items exceed the maximum allowed selections for this session.",
      });
    }

    const wheelRound = await WheelRound.create({
      sessionId,
      wheelItems,
      status: "pending",
    });

    return res.status(201).json({
      wheelRound: serialiseWheelRound(wheelRound),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create wheel round.";
    return res.status(500).json({ message });
  }
}
