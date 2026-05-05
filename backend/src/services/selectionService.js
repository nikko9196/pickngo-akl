const mongoose = require("mongoose");

const RecommendationSnapshot = require("../models/RecommendationSnapshot");
const Session = require("../models/Session");
const SessionSelection = require("../models/SessionSelection");
const { presentSnapshot } = require("./placePresentationService");
const HttpError = require("../utils/httpError");

function getUserIdValue(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  return value.toString();
}

function validateSessionId(sessionId) {
  if (!mongoose.isValidObjectId(sessionId)) {
    throw new HttpError(400, "Session ID is invalid.");
  }
}

function ensureParticipantAccess(session, requesterUserId) {
  const isParticipant = session.participants.some(
    (participant) => getUserIdValue(participant.userId) === requesterUserId
  );

  if (!isParticipant) {
    throw new HttpError(403, "You are not a participant in this room.");
  }
}

function getParticipantDetails(session, userId) {
  const participant = session.participants.find(
    (entry) => getUserIdValue(entry.userId) === userId
  );

  if (!participant) {
    return null;
  }

  return {
    userId: getUserIdValue(participant.userId),
    roomDisplayName: participant.roomDisplayName || "",
    role: participant.role || "",
  };
}

function presentSelectionRestaurant(restaurant) {
  return {
    placeId: restaurant.placeId || "",
    name: restaurant.name || "",
    address: restaurant.address || "",
    district: restaurant.district || "",
    location: {
      lat: Number.isFinite(restaurant.location?.lat) ? restaurant.location.lat : null,
      lng: Number.isFinite(restaurant.location?.lng) ? restaurant.location.lng : null,
    },
    rating: Number.isFinite(restaurant.rating) ? restaurant.rating : null,
    priceLevel: Number.isFinite(restaurant.priceLevel) ? restaurant.priceLevel : null,
    cuisine: Array.isArray(restaurant.cuisine) ? restaurant.cuisine : [],
    distance: Number.isFinite(restaurant.distance) ? restaurant.distance : null,
    openNow: typeof restaurant.openNow === "boolean" ? restaurant.openNow : false,
  };
}

function presentSelectionDocument(selection, participant = null) {
  return {
    sessionId: getUserIdValue(selection.sessionId),
    userId: getUserIdValue(selection.userId),
    recommendationSnapshotId: getUserIdValue(selection.recommendationSnapshotId),
    participant,
    selections: Array.isArray(selection.selections)
      ? selection.selections.map(presentSelectionRestaurant)
      : [],
    submittedAt: selection.submittedAt || null,
    updatedAt: selection.updatedAt || null,
  };
}

function normalizePlaceIds(rawPlaceIds) {
  if (!Array.isArray(rawPlaceIds)) {
    throw new HttpError(400, "placeIds must be an array.");
  }

  if (rawPlaceIds.length === 0) {
    throw new HttpError(400, "Please select at least one restaurant.");
  }

  const normalizedPlaceIds = rawPlaceIds.map((placeId) => {
    if (typeof placeId !== "string") {
      throw new HttpError(400, "Each placeId must be a string.");
    }

    const normalizedValue = placeId.trim();

    if (!normalizedValue) {
      throw new HttpError(400, "placeIds cannot contain empty values.");
    }

    return normalizedValue;
  });

  if (new Set(normalizedPlaceIds).size !== normalizedPlaceIds.length) {
    throw new HttpError(400, "placeIds cannot contain duplicates.");
  }

  return normalizedPlaceIds;
}

async function fetchSelectionSession(sessionId) {
  return Session.findById(sessionId).select("status maxSelectionsPerUser participants").lean();
}

async function getLatestRecommendationSnapshot(sessionId) {
  return RecommendationSnapshot.findOne({ sessionId }).sort({ generatedAt: -1 }).lean();
}

function buildRestaurantLookup(snapshot) {
  const presentedSnapshot = presentSnapshot(snapshot);

  return new Map(
    (presentedSnapshot.restaurants || [])
      .filter((restaurant) => restaurant?.placeId)
      .map((restaurant) => [restaurant.placeId, restaurant])
  );
}

function resolveSelectedRestaurants(placeIds, snapshot) {
  const restaurantLookup = buildRestaurantLookup(snapshot);
  const selectedRestaurants = placeIds.map((placeId) => restaurantLookup.get(placeId));
  const missingPlaceIds = placeIds.filter((placeId, index) => !selectedRestaurants[index]);

  if (missingPlaceIds.length > 0) {
    throw new HttpError(
      400,
      `Some selected restaurants are not available in the latest recommendation snapshot: ${missingPlaceIds.join(", ")}`
    );
  }

  return selectedRestaurants.map(presentSelectionRestaurant);
}

async function saveSelectionsForSession({ sessionId, requesterUserId, placeIds }) {
  validateSessionId(sessionId);

  const session = await fetchSelectionSession(sessionId);

  if (!session) {
    throw new HttpError(404, "Room not found.");
  }

  ensureParticipantAccess(session, requesterUserId);

  if (session.status !== "selecting") {
    throw new HttpError(
      409,
      "Restaurant selections can only be saved when the room status is selecting."
    );
  }

  const normalizedPlaceIds = normalizePlaceIds(placeIds);

  if (normalizedPlaceIds.length > session.maxSelectionsPerUser) {
    throw new HttpError(
      400,
      `You can select at most ${session.maxSelectionsPerUser} restaurants in this room.`
    );
  }

  const latestSnapshot = await getLatestRecommendationSnapshot(session._id);

  if (!latestSnapshot) {
    throw new HttpError(404, "No recommendation snapshot has been generated yet.");
  }

  const selectedRestaurants = resolveSelectedRestaurants(normalizedPlaceIds, latestSnapshot);

  const selection = await SessionSelection.findOneAndUpdate(
    {
      sessionId: session._id,
      userId: requesterUserId,
    },
    {
      $set: {
        recommendationSnapshotId: latestSnapshot._id,
        selections: selectedRestaurants,
      },
    },
    {
      returnDocument: "after",
      upsert: true,
      runValidators: true,
      setDefaultsOnInsert: true,
    }
  );

  return {
    message: "Saved your restaurant selections.",
    selection: presentSelectionDocument(
      selection.toObject(),
      getParticipantDetails(session, requesterUserId)
    ),
  };
}

async function getMySelectionsForSession({ sessionId, requesterUserId }) {
  validateSessionId(sessionId);

  const session = await fetchSelectionSession(sessionId);

  if (!session) {
    throw new HttpError(404, "Room not found.");
  }

  ensureParticipantAccess(session, requesterUserId);

  const selection = await SessionSelection.findOne({
    sessionId: session._id,
    userId: requesterUserId,
  }).lean();

  if (!selection) {
    return {
      message: "You have not saved any restaurant selections for this room yet.",
      selection: null,
    };
  }

  return {
    message: "Fetched your saved restaurant selections.",
    selection: presentSelectionDocument(
      selection,
      getParticipantDetails(session, requesterUserId)
    ),
  };
}

async function getSelectionsForSession({ sessionId, requesterUserId }) {
  validateSessionId(sessionId);

  const session = await fetchSelectionSession(sessionId);

  if (!session) {
    throw new HttpError(404, "Room not found.");
  }

  ensureParticipantAccess(session, requesterUserId);

  const savedSelections = await SessionSelection.find({ sessionId: session._id })
    .sort({ submittedAt: 1, updatedAt: 1 })
    .lean();

  const participantOrder = new Map(
    session.participants.map((participant, index) => [getUserIdValue(participant.userId), index])
  );

  const selections = savedSelections
    .map((selection) =>
      presentSelectionDocument(
        selection,
        getParticipantDetails(session, getUserIdValue(selection.userId))
      )
    )
    .sort((left, right) => {
      const leftOrder = participantOrder.get(left.userId) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = participantOrder.get(right.userId) ?? Number.MAX_SAFE_INTEGER;
      return leftOrder - rightOrder;
    });

  return {
    message: "Fetched saved restaurant selections for this room.",
    selections,
  };
}

module.exports = {
  getMySelectionsForSession,
  getSelectionsForSession,
  saveSelectionsForSession,
};
