const mongoose = require("mongoose");

const QuestionList = require("../models/QuestionList");
const RecommendationSnapshot = require("../models/RecommendationSnapshot");
const Response = require("../models/Response");
const Session = require("../models/Session");
const {
  SNAPSHOT_CACHE_WINDOW_MINUTES,
} = require("../config/recommendationQuestionMap");
const { combineGroupPreferences } = require("./groupPreferenceService");
const { searchGooglePlaces } = require("./googlePlacesService");
const { normalizePlace } = require("./placeNormalizationService");
const {
  buildQuestionLookup,
  createEmptyParticipantPreference,
  parseParticipantPreferences,
  participantHasUsablePreferences,
} = require("./preferenceParserService");
const { rankRestaurants } = require("./placeScoringService");
const HttpError = require("../utils/httpError");

const SNAPSHOT_CACHE_WINDOW_MS = SNAPSHOT_CACHE_WINDOW_MINUTES * 60 * 1000;

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
  return Session.findById(sessionId).select("status participants");
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

async function createRecommendationSnapshot({ session, groupPrefs, restaurants }) {
  return RecommendationSnapshot.create({
    sessionId: session._id,
    generatedAt: new Date(),
    groupPrefs,
    restaurants,
  });
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
      snapshot: latestSnapshot.toObject(),
      sessionStatus: session.status,
    };
  }

  const responses = await Response.find({ sessionId: session._id.toString() })
    .sort({ createdAt: 1 })
    .lean();

  if (responses.length === 0) {
    throw new HttpError(
      409,
      "No questionnaire responses are available for recommendation generation yet."
    );
  }

  const questionLookup = await loadQuestionLookup();
  const parsedParticipants = parseParticipantPreferences(responses, questionLookup);
  const sessionParticipants = attachSessionParticipants(parsedParticipants, session.participants);
  const usableParticipants = sessionParticipants.filter(participantHasUsablePreferences);

  if (usableParticipants.length === 0) {
    throw new HttpError(
      409,
      "No usable responses match the current recommendation question mapping yet."
    );
  }

  const groupPrefs = combineGroupPreferences(usableParticipants);
  const places = await searchGooglePlaces(groupPrefs);
  const normalizedPlaces = places
    .map((place) => normalizePlace(place, groupPrefs))
    .filter(Boolean);
  const rankedRestaurants = rankRestaurants(normalizedPlaces, groupPrefs);
  const snapshot = await createRecommendationSnapshot({
    session,
    groupPrefs,
    restaurants: rankedRestaurants,
  });

  if (rankedRestaurants.length > 0) {
    session.status = "selecting";
    await session.save();
  }

  return {
    cached: false,
    message:
      rankedRestaurants.length > 0
        ? "Generated group recommendations."
        : "No restaurants matched the current group preferences. Saved an empty recommendation snapshot.",
    snapshot: snapshot.toObject(),
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
    throw new HttpError(404, "No recommendation snapshot has been generated yet.");
  }

  return {
    message: "Fetched the latest recommendation snapshot.",
    snapshot: latestSnapshot.toObject(),
    sessionStatus: session.status,
  };
}

module.exports = {
  generateRecommendationsForSession,
  getLatestRecommendationsForSession,
};
