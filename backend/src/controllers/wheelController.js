const UserSelection = require("../models/UserSelection");
const RecommendationSnapshot = require("../models/RecommendationSnapshot");
const {
  findSessionById,
  checkValidParticipant,
  checkSessionStatus,
} = require("../services/sessionService");
const { getErrorStatus } = require("../utils/errorUtils");
const { getUniquePlaceIds } = require("../utils/wheelUtils");

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
        userId: selection.userId,
        roomDisplayName: getParticipantRoomDisplayName(
          session,
          selection.userId,
        ),
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
    session.currentWheelResult = null;
    session.finalWheelResult = null;
    session.voteSummary = {
      acceptCount: 0,
      respinCount: 0,
      votedUserIds: [],
    };

    await session.save();

    const snapshot = await getLatestRecommendationSnapshot(sessionId);

    const detailedWheelItems = wheelItems.map((item) =>
      getRestaurantDetails(snapshot, item),
    );

    return res.status(200).json({
      session: {
        id: session._id.toString(),
        wheelItems: detailedWheelItems,
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

    checkSessionStatus(session, "spinning");

    const randomIndex = Math.floor(Math.random() * session.wheelItems.length);

    const selectedItem = session.wheelItems[randomIndex];

    const snapshot = await getLatestRecommendationSnapshot(sessionId);
    const detailedResult = getRestaurantDetails(snapshot, selectedItem);

    session.currentWheelResult = {
      recommendationSetId: selectedItem.recommendationSetId,
      placeId: selectedItem.placeId,
    };

    const uniquePlaceIds = getUniquePlaceIds(session.wheelItems);
    const isFinalSpin = uniquePlaceIds.length <= 2;

    if (isFinalSpin) {
      session.finalWheelResult = session.currentWheelResult;
      session.status = "completed";
    } else {
      session.status = "voting";

      session.voteSummary = {
        acceptCount: 0,
        respinCount: 0,
        votedUserIds: [],
      };
    }

    await session.save();

    return res.status(200).json({
      session: {
        id: session._id.toString(),
        currentWheelResult: detailedResult,
        finalSpin: isFinalSpin,
        status: session.status,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to spin the wheel.";
    return res.status(getErrorStatus(error)).json({ message });
  }
}

async function getLatestRecommendationSnapshot(sessionId) {
  return RecommendationSnapshot.findOne({ sessionId }).sort({
    generatedAt: -1,
  });
}

function getRestaurantByPlaceId(snapshot, placeId) {
  if (!snapshot) {
    return null;
  }

  return (
    snapshot.restaurants.find((restaurant) => restaurant.placeId === placeId) ||
    null
  );
}

function getRestaurantDetails(snapshot, item) {
  const restaurant = getRestaurantByPlaceId(snapshot, item.placeId);

  return {
    userId: item.userId || "",
    roomDisplayName: item.roomDisplayName || "",
    recommendationSetId: item.recommendationSetId,
    placeId: item.placeId,
    name: restaurant?.name || "",
    address: restaurant?.address || "",
    district: restaurant?.district || "",
    rating: restaurant?.rating ?? null,
    priceLevel: restaurant?.priceLevel ?? null,
    cuisine: restaurant?.cuisine || [],
    photos: restaurant?.photos || [],
    distance: restaurant?.distance ?? null,
    openNow: restaurant?.openNow ?? false,
  };
}

function getParticipantRoomDisplayName(session, userId) {
  const participant = session.participants.find(
    (participant) => participant.userId.toString() === userId,
  );

  return participant?.roomDisplayName || "";
}

module.exports = {
  buildWheel,
  spinWheel,
};
