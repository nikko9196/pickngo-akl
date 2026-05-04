const RecommendationSnapshot = require("../models/RecommendationSnapshot");
const SessionSelection = require("../models/SessionSelection");
const {
  findSessionById,
  checkValidParticipant,
  checkSessionStatus,
  checkValidHost,
} = require("../services/sessionService");
const { getErrorStatus } = require("../utils/errorUtils");
const { getUniquePlaceIds } = require("../utils/wheelUtils");

function getStringValue(value) {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  return value.toString();
}

function getWheelSnapshotId(item) {
  return getStringValue(
    item?.recommendationSnapshotId || item?.recommendationSetId || "",
  );
}

function getWheelItemKey(snapshotId, placeId) {
  return `${snapshotId}::${placeId}`;
}

async function getSessionSelections(sessionId) {
  return SessionSelection.find({ sessionId }).lean();
}

async function getSnapshotsByIds(snapshotIds) {
  if (!snapshotIds.length) {
    return [];
  }

  return RecommendationSnapshot.find({
    _id: { $in: snapshotIds },
  }).lean();
}

function collectSnapshotIdsFromSession(session) {
  const snapshotIds = new Set();

  for (const item of session.wheelItems || []) {
    const snapshotId = getWheelSnapshotId(item);

    if (snapshotId) {
      snapshotIds.add(snapshotId);
    }
  }

  for (const item of [session.currentWheelResult, session.finalWheelResult]) {
    const snapshotId = getWheelSnapshotId(item);

    if (snapshotId) {
      snapshotIds.add(snapshotId);
    }
  }

  return snapshotIds;
}

function getParticipantRoomDisplayName(session, userId) {
  const participant = session.participants.find(
    (entry) => entry.userId.toString() === userId,
  );

  return participant?.roomDisplayName || "";
}

function buildSelectionEntries(session, sessionSelections) {
  return sessionSelections.flatMap((selection) => {
    const userId = getStringValue(selection.userId);
    const recommendationSnapshotId = getStringValue(
      selection.recommendationSnapshotId,
    );
    const roomDisplayName = getParticipantRoomDisplayName(session, userId);

    return (selection.selections || [])
      .filter((restaurant) => restaurant?.placeId)
      .map((restaurant) => ({
        recommendationSnapshotId,
        placeId: restaurant.placeId,
        userId,
        roomDisplayName,
        restaurant,
      }));
  });
}

function buildSelectionLookup(entries) {
  const lookup = new Map();

  for (const entry of entries) {
    const key = getWheelItemKey(entry.recommendationSnapshotId, entry.placeId);

    if (!lookup.has(key)) {
      lookup.set(key, entry);
    }
  }

  return lookup;
}

function buildSnapshotLookup(snapshots) {
  return new Map(
    snapshots.map((snapshot) => [getStringValue(snapshot._id), snapshot]),
  );
}

function getSnapshotRestaurant(snapshotLookup, snapshotId, placeId) {
  const snapshot = snapshotLookup.get(snapshotId);

  if (!snapshot) {
    return null;
  }

  return (
    snapshot.restaurants.find((restaurant) => restaurant.placeId === placeId) ||
    null
  );
}

async function buildWheelContext(session) {
  const sessionSelections = await getSessionSelections(session._id);
  const selectionEntries = buildSelectionEntries(session, sessionSelections);
  const snapshotIds = new Set(
    selectionEntries
      .map((entry) => entry.recommendationSnapshotId)
      .filter(Boolean),
  );

  for (const snapshotId of collectSnapshotIdsFromSession(session)) {
    snapshotIds.add(snapshotId);
  }

  const snapshots = await getSnapshotsByIds([...snapshotIds]);

  return {
    selectionEntries,
    selectionLookup: buildSelectionLookup(selectionEntries),
    snapshotLookup: buildSnapshotLookup(snapshots),
  };
}

function getRestaurantDetails({ selectionLookup, snapshotLookup, item }) {
  const recommendationSnapshotId = getWheelSnapshotId(item);
  const key = getWheelItemKey(recommendationSnapshotId, item.placeId);
  const selectionEntry = item.restaurant ? item : selectionLookup.get(key);
  const baseRestaurant = selectionEntry?.restaurant || {};
  const snapshotRestaurant = getSnapshotRestaurant(
    snapshotLookup,
    recommendationSnapshotId,
    item.placeId,
  );

  return {
    userId: item.userId || selectionEntry?.userId || "",
    roomDisplayName:
      item.roomDisplayName || selectionEntry?.roomDisplayName || "",
    recommendationSnapshotId,
    placeId: item.placeId,
    name: baseRestaurant.name || snapshotRestaurant?.name || "",
    address: baseRestaurant.address || snapshotRestaurant?.address || "",
    district: baseRestaurant.district || snapshotRestaurant?.district || "",
    location: {
      lat:
        baseRestaurant.location?.lat ??
        snapshotRestaurant?.location?.lat ??
        snapshotRestaurant?.latitude ??
        null,
      lng:
        baseRestaurant.location?.lng ??
        snapshotRestaurant?.location?.lng ??
        snapshotRestaurant?.longitude ??
        null,
    },
    rating: baseRestaurant.rating ?? snapshotRestaurant?.rating ?? null,
    priceLevel:
      baseRestaurant.priceLevel ?? snapshotRestaurant?.priceLevel ?? null,
    cuisine: baseRestaurant.cuisine || snapshotRestaurant?.cuisine || [],
    photos: snapshotRestaurant?.photos || [],
    distance:
      baseRestaurant.distance ??
      snapshotRestaurant?.distance ??
      snapshotRestaurant?.distanceKm ??
      null,
    openNow:
      typeof baseRestaurant.openNow === "boolean"
        ? baseRestaurant.openNow
        : Boolean(snapshotRestaurant?.openNow),
  };
}

async function buildWheel(req, res) {
  const sessionId = req.params.sessionId?.trim();

  try {
    const session = await findSessionById(sessionId);
    checkValidParticipant(session, req.userId);

    const { selectionEntries, selectionLookup, snapshotLookup } =
      await buildWheelContext(session);

    if (["voting", "completed"].includes(session.status)) {
      const detailedWheelItems = (session.wheelItems || []).map((item) =>
        getRestaurantDetails({ selectionLookup, snapshotLookup, item }),
      );

      return res.status(200).json({
        session: {
          id: session._id.toString(),
          status: session.status,
          wheelItems: detailedWheelItems,
        },
      });
    }

    if (!selectionEntries.length) {
      return res.status(404).json({
        message:
          "No saved restaurant selections found for this session to build the wheel.",
      });
    }

    const wheelItems = selectionEntries.map((entry) => ({
      recommendationSnapshotId: entry.recommendationSnapshotId,
      placeId: entry.placeId,
      userId: entry.userId,
      roomDisplayName: entry.roomDisplayName,
      restaurant: entry.restaurant,
    }));

    const maxPossibleWheelItems =
      session.participants.length * session.maxSelectionsPerUser;

    if (wheelItems.length > maxPossibleWheelItems) {
      return res.status(400).json({
        message:
          "Wheel items exceed the maximum allowed selections for this session.",
      });
    }

    session.wheelItems = wheelItems.map((item) => ({
      recommendationSnapshotId: item.recommendationSnapshotId,
      placeId: item.placeId,
      userId: item.userId,
      roomDisplayName: item.roomDisplayName,
    }));
    session.currentWheelResult = null;
    session.lastWheelResult = null;
    session.finalWheelResult = null;
    session.voteSummary = {
      acceptCount: 0,
      respinCount: 0,
      votedUserIds: [],
    };
    session.lastVoteSummary = null;

    await session.save();

    const detailedWheelItems = wheelItems.map((item) =>
      getRestaurantDetails({ selectionLookup, snapshotLookup, item }),
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

    checkValidHost(session, req.userId, "Only the host can spin the wheel.");

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
    const { selectionLookup, snapshotLookup } =
      await buildWheelContext(session);
    const detailedResult = getRestaurantDetails({
      selectionLookup,
      snapshotLookup,
      item: selectedItem,
    });

    session.currentWheelResult = {
      recommendationSnapshotId: getWheelSnapshotId(selectedItem),
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

async function getCurrentWheel(req, res) {
  const sessionId = req.params.sessionId?.trim();

  try {
    const session = await findSessionById(sessionId);
    checkValidParticipant(session, req.userId);

    const { selectionLookup, snapshotLookup } =
      await buildWheelContext(session);
    const currentWheelItems = session.wheelItems || [];

    const detailedWheelItems = currentWheelItems.map((item) =>
      getRestaurantDetails({ selectionLookup, snapshotLookup, item }),
    );

    const lastWheelResult = session.lastWheelResult?.placeId
      ? getRestaurantDetails({
          selectionLookup,
          snapshotLookup,
          item: session.lastWheelResult,
        })
      : null;

    return res.status(200).json({
      session: {
        id: session._id.toString(),
        status: session.status,
        wheelItems: detailedWheelItems,
        lastWheelResult,
        lastVoteSummary: session.lastVoteSummary,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch current wheel.";
    return res.status(getErrorStatus(error)).json({ message });
  }
}

async function getFinalWheelResult(req, res) {
  const sessionId = req.params.sessionId?.trim();

  try {
    const session = await findSessionById(sessionId);
    checkValidParticipant(session, req.userId);

    if (!session.finalWheelResult?.placeId) {
      return res.status(404).json({
        message: "No final wheel result found.",
      });
    }

    const { selectionLookup, snapshotLookup } =
      await buildWheelContext(session);
    const finalResult = getRestaurantDetails({
      selectionLookup,
      snapshotLookup,
      item: session.finalWheelResult,
    });

    return res.status(200).json({
      session: {
        id: session._id.toString(),
        status: session.status,
        finalWheelResult: finalResult,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to fetch final wheel result.";
    return res.status(getErrorStatus(error)).json({ message });
  }
}

module.exports = {
  buildWheel,
  spinWheel,
  getCurrentWheel,
  getFinalWheelResult,
};
