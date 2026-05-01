const UserSelection = require("../models/UserSelection");
const RecommendationSnapshot = require("../models/RecommendationSnapshot");
const {
  findSessionById,
  checkValidParticipant,
  checkSessionStatus,
} = require("../services/sessionService");
const { getErrorStatus } = require("../utils/errorUtils");

function normalizeSelectedItems(rawSelectedItems) {
  if (!Array.isArray(rawSelectedItems)) {
    return [];
  }

  const placeIds = rawSelectedItems
    .map((item) => {
      if (typeof item === "string") {
        return item.trim();
      }

      return item?.placeId?.trim();
    })
    .filter(Boolean);

  return [...new Set(placeIds)].map((placeId) => ({ placeId }));
}

async function getLatestRecommendationSnapshot(sessionId) {
  return RecommendationSnapshot.findOne({ sessionId }).sort({
    generatedAt: -1,
  });
}

function validateSelectedPlaceIds(snapshot, selectedItems) {
  if (!snapshot) {
    const error = new Error(
      "No recommendation snapshot found for this session.",
    );
    error.statusCode = 404;
    throw error;
  }

  const validPlaceIds = new Set(
    snapshot.restaurants.map((restaurant) => restaurant.placeId),
  );

  const invalidItems = selectedItems.filter(
    (item) => !validPlaceIds.has(item.placeId),
  );

  if (invalidItems.length > 0) {
    const error = new Error(
      "One or more selected places are not valid recommendations.",
    );
    error.statusCode = 400;
    throw error;
  }
}

async function saveUserSelections(req, res) {
  const sessionId = req.params.sessionId?.trim();
  const selectedItems = normalizeSelectedItems(req.body.selectedItems);

  if (!selectedItems.length) {
    return res.status(400).json({
      message: "At least one selected item is required.",
    });
  }

  try {
    const session = await findSessionById(sessionId);
    checkValidParticipant(session, req.userId);
    checkSessionStatus(session, "selecting");

    if (selectedItems.length > session.maxSelectionsPerUser) {
      return res.status(400).json({
        message: `You can select up to ${session.maxSelectionsPerUser} item(s).`,
      });
    }

    const snapshot = await getLatestRecommendationSnapshot(sessionId);
    validateSelectedPlaceIds(snapshot, selectedItems);

    const userSelection = await UserSelection.findOneAndUpdate(
      {
        sessionId,
        userId: req.userId,
      },
      {
        $set: {
          recommendationSetId: snapshot._id.toString(),
          selectedItems,
        },
        $setOnInsert: {
          sessionId,
          userId: req.userId,
        },
      },
      {
        returnDocument: "after",
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );

    return res.status(200).json({
      message: "User selections saved.",
      userSelection: {
        sessionId: userSelection.sessionId,
        userId: userSelection.userId,
        recommendationSetId: userSelection.recommendationSetId,
        selectedItems: userSelection.selectedItems,
        createdAt: userSelection.createdAt,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to save user selections.";
    return res.status(getErrorStatus(error)).json({ message });
  }
}

module.exports = {
  saveUserSelections,
};
