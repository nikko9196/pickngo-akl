const mongoose = require("mongoose");

const QuestionList = require("../models/QuestionList");
const RecommendationSnapshot = require("../models/RecommendationSnapshot");
const Response = require("../models/Response");
const Session = require("../models/Session");
const {
  DEFAULT_MAX_DISTANCE_KM,
  SNAPSHOT_CACHE_WINDOW_MINUTES,
} = require("../config/recommendationQuestionMap");
const { combineGroupPreferences } = require("./groupPreferenceService");
const { searchGooglePlaces } = require("./googlePlacesService");
const { normalizePlace } = require("./placeNormalizationService");
const { presentRankedRestaurants, presentSnapshot } = require("./placePresentationService");
const {
  buildQuestionLookup,
  createEmptyParticipantPreference,
  parseParticipantPreferences,
  participantHasUsablePreferences,
} = require("./preferenceParserService");
const { rankRestaurants } = require("./placeScoringService");
const { clampNumber, roundNumber } = require("../utils/geo");
const HttpError = require("../utils/httpError");

const SNAPSHOT_CACHE_WINDOW_MS = SNAPSHOT_CACHE_WINDOW_MINUTES * 60 * 1000;
const LOCATION_RADIUS_MIN_METERS = 100;
const LOCATION_RADIUS_MAX_METERS = 50000;

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

async function fetchSessionForRecommendations(sessionId) {
  return Session.findById(sessionId).select("status participants location");
}

async function getLatestRecommendationSnapshot(sessionId) {
  return RecommendationSnapshot.findOne({ sessionId }).sort({ generatedAt: -1 });
}

async function loadQuestionLookup() {
  const questionLists = await QuestionList.find({})
    .select("category questionList.questionId questionList.questionType")
    .lean();

  return buildQuestionLookup(questionLists);
}

function attachSessionParticipants(parsedParticipants, sessionParticipants) {
  const parsedParticipantsByUserId = new Map(
    parsedParticipants.map((participant) => [participant.userId, participant])
  );

  return sessionParticipants.map((participant) => {
    const userId = getUserIdValue(participant.userId);
    return parsedParticipantsByUserId.get(userId) || createEmptyParticipantPreference(userId);
  });
}

async function createRecommendationSnapshot({
  session,
  groupPrefs,
  restaurants,
  usedFallback = false,
  fallbackReason = "",
}) {
  return RecommendationSnapshot.create({
    sessionId: session._id,
    generatedAt: new Date(),
    usedFallback,
    fallbackReason,
    groupPrefs,
    restaurants,
  });
}

function createFallbackGroupPreferences() {
  // Reuse the normal group preference combiner so fallback behavior stays aligned
  // with the same default location and distance settings as the main pipeline.
  return combineGroupPreferences([]);
}

function resolveSessionSearchLocation(session) {
  const latitude = session?.location?.lat;
  const longitude = session?.location?.lng;

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const radiusMeters = Number.isFinite(session.location?.radiusMeters)
    ? clampNumber(
        session.location.radiusMeters,
        LOCATION_RADIUS_MIN_METERS,
        LOCATION_RADIUS_MAX_METERS
      )
    : DEFAULT_MAX_DISTANCE_KM * 1000;

  return {
    latitude,
    longitude,
    maxDistanceKm: roundNumber(radiusMeters / 1000, 1),
  };
}

function applySessionLocationToGroupPreferences(groupPrefs, session) {
  const sessionLocation = resolveSessionSearchLocation(session);

  if (!sessionLocation) {
    return groupPrefs;
  }

  return {
    ...groupPrefs,
    ...sessionLocation,
  };
}

function createNearbyFallbackGroupPreferences(groupPrefs) {
  return {
    topCuisines: [],
    preferredPrice: "",
    dietary: Array.isArray(groupPrefs.dietary) ? groupPrefs.dietary : [],
    exclude: Array.isArray(groupPrefs.exclude) ? groupPrefs.exclude : [],
    coffeePreference: "",
    openLatePreference: "",
    serviceMode: "",
    specialRequestKeywords: [],
    maxDistanceKm: Math.max(
      Number.isFinite(groupPrefs.maxDistanceKm) ? groupPrefs.maxDistanceKm * 1.5 : 0,
      DEFAULT_MAX_DISTANCE_KM * 1.5
    ),
    latitude: groupPrefs.latitude,
    longitude: groupPrefs.longitude,
  };
}

async function searchAndPresentRestaurants(groupPrefs) {
  const places = await searchGooglePlaces(groupPrefs);
  const normalizedPlaces = places
    .map((place) => normalizePlace(place, groupPrefs))
    .filter(Boolean);
  const rankedRestaurants = rankRestaurants(normalizedPlaces, groupPrefs);
  return presentRankedRestaurants(rankedRestaurants);
}

function buildGenerationMessage({ restaurantsFound, usedFallback, fallbackReason }) {
  if (usedFallback && fallbackReason === "no_usable_responses") {
    return restaurantsFound
      ? "Generated fallback location-based recommendations because no usable questionnaire responses were available."
      : "No usable questionnaire responses were available, and no nearby fallback recommendations matched.";
  }

  if (usedFallback && fallbackReason === "no_matches_for_preferences") {
    return restaurantsFound
      ? "We couldn't find strong matches for the group's preferences, so we're showing nearby alternatives instead."
      : "No restaurants matched the group's preferences or nearby fallback alternatives. Saved an empty recommendation snapshot.";
  }

  return restaurantsFound
    ? "Generated group recommendations."
    : "No restaurants matched the current group preferences. Saved an empty recommendation snapshot.";
}

async function generateRecommendationsForSession({
  sessionId,
  requesterUserId,
  refresh = false,
}) {
  validateSessionId(sessionId);

  const session = await fetchSessionForRecommendations(sessionId);

  if (!session) {
    throw new HttpError(404, "Room not found.");
  }

  ensureParticipantAccess(session, requesterUserId);

  if (session.status !== "generating") {
    throw new HttpError(
      409,
      "Recommendations can only be generated when the room status is generating."
    );
  }

  const latestSnapshot = await getLatestRecommendationSnapshot(session._id);

  if (
    latestSnapshot &&
    !refresh &&
    Date.now() - latestSnapshot.generatedAt.getTime() < SNAPSHOT_CACHE_WINDOW_MS
  ) {
    // Reuse a fresh snapshot to avoid duplicate Google API calls during retries or page refreshes.
    return {
      cached: true,
      message: "Returning the most recent recommendation snapshot.",
      snapshot: presentSnapshot(latestSnapshot.toObject()),
      sessionStatus: session.status,
    };
  }

  const responses = await Response.find({ sessionId: session._id.toString() })
    .sort({ createdAt: 1 })
    .lean();

  let usedFallback = false;
  let fallbackReason = "";
  let groupPrefs;

  if (responses.length === 0) {
    usedFallback = true;
    fallbackReason = "no_usable_responses";
    groupPrefs = createFallbackGroupPreferences();
  } else {
    const questionLookup = await loadQuestionLookup();
    const parsedParticipants = parseParticipantPreferences(responses, questionLookup);
    const sessionParticipants = attachSessionParticipants(parsedParticipants, session.participants);
    const usableParticipants = sessionParticipants.filter(participantHasUsablePreferences);

    if (usableParticipants.length === 0) {
      usedFallback = true;
      fallbackReason = "no_usable_responses";
      groupPrefs = createFallbackGroupPreferences();
    } else {
      groupPrefs = combineGroupPreferences(usableParticipants);
    }
  }

  groupPrefs = applySessionLocationToGroupPreferences(groupPrefs, session);
  let searchGroupPrefs = groupPrefs;
  let presentedRestaurants = await searchAndPresentRestaurants(searchGroupPrefs);

  if (presentedRestaurants.length === 0 && !usedFallback) {
    usedFallback = true;
    fallbackReason = "no_matches_for_preferences";
    searchGroupPrefs = createNearbyFallbackGroupPreferences(groupPrefs);
    presentedRestaurants = await searchAndPresentRestaurants(searchGroupPrefs);
  }

  const snapshot = await createRecommendationSnapshot({
    session,
    groupPrefs,
    restaurants: presentedRestaurants,
    usedFallback,
    fallbackReason,
  });

  if (presentedRestaurants.length > 0) {
    session.status = "selecting";
    await session.save();
  }

  return {
    cached: false,
    message: buildGenerationMessage({
      restaurantsFound: presentedRestaurants.length > 0,
      usedFallback,
      fallbackReason,
    }),
    usedFallback,
    fallbackReason,
    snapshot: presentSnapshot(snapshot.toObject()),
    sessionStatus: session.status,
  };
}

async function getLatestRecommendationsForSession({ sessionId, requesterUserId }) {
  validateSessionId(sessionId);

  const session = await fetchSessionForRecommendations(sessionId);

  if (!session) {
    throw new HttpError(404, "Room not found.");
  }

  ensureParticipantAccess(session, requesterUserId);

  const latestSnapshot = await getLatestRecommendationSnapshot(session._id);

  if (!latestSnapshot) {
    return {
      message: "No recommendation snapshot has been generated yet.",
      snapshot: null,
      sessionStatus: session.status,
    };
  }

  return {
    message: "Fetched the latest recommendation snapshot.",
    snapshot: presentSnapshot(latestSnapshot.toObject()),
    sessionStatus: session.status,
  };
}

module.exports = {
  generateRecommendationsForSession,
  getLatestRecommendationsForSession,
};
