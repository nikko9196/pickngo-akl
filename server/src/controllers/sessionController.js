const Session = require("../models/Session");
const Response = require("../models/Response");
const QuestionList = require("../models/QuestionList");

const APP_BASE_URL = process.env.CLIENT_BASE_URL || "http://localhost:5173";
const SESSION_CODE_LENGTH = 6;
const SESSION_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const ROOM_DISPLAY_NAME_MAX_LENGTH = 30;
const SESSION_STATUSES = [
  "waiting",
  "questioning",
  "generating",
  "selecting",
  "spinning",
  "voting",
  "completed",
];

function generateSessionCode() {
  let code = "";

  for (let index = 0; index < SESSION_CODE_LENGTH; index += 1) {
    const randomIndex = Math.floor(Math.random() * SESSION_CODE_ALPHABET.length);
    code += SESSION_CODE_ALPHABET[randomIndex];
  }

  return code;
}

async function createUniqueSessionCode() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const sessionCode = generateSessionCode();
    const existingSession = await Session.exists({ sessionCode });

    if (!existingSession) {
      return sessionCode;
    }
  }

  throw new Error("Unable to generate a unique session code.");
}

function getUserIdValue(user) {
  if (!user) {
    return "";
  }

  if (typeof user === "string") {
    return user;
  }

  if (user._id) {
    return user._id.toString();
  }

  return user.toString();
}

function parseRoomDisplayName(rawValue) {
  const roomDisplayName = rawValue?.trim();

  if (!roomDisplayName || roomDisplayName.length > ROOM_DISPLAY_NAME_MAX_LENGTH) {
    return null;
  }

  return roomDisplayName;
}

function serializeSession(session, currentUserId) {
  const sessionObject = session.toObject();
  const participantCount = sessionObject.participants.length;
  const currentParticipant = sessionObject.participants.find(
    (participant) => getUserIdValue(participant.userId) === currentUserId
  );

  return {
    id: sessionObject._id.toString(),
    hostUserId: getUserIdValue(sessionObject.hostUserId),
    sessionCode: sessionObject.sessionCode,
    joinUrl: sessionObject.joinUrl,
    status: sessionObject.status,
    maxParticipants: sessionObject.maxParticipants,
    participantCount,
    currentUserRole: currentParticipant?.role || null,
    currentUserRoomDisplayName: currentParticipant?.roomDisplayName || "",
    participants: sessionObject.participants.map((participant) => ({
      userId: getUserIdValue(participant.userId),
      role: participant.role,
      roomDisplayName: participant.roomDisplayName,
      avatarUrl:
        participant.userId && typeof participant.userId === "object"
          ? participant.userId.avatarUrl || ""
          : "",
      accountDisplayName:
        participant.userId && typeof participant.userId === "object"
          ? participant.userId.displayName || ""
          : "",
      joinedAt: participant.joinedAt,
    })),
    createdAt: sessionObject.createdAt,
    updatedAt: sessionObject.updatedAt,
  };
}

async function fetchSession(query) {
  return Session.findOne(query).populate("participants.userId", "displayName avatarUrl");
}

async function fetchSessionById(sessionId) {
  return Session.findById(sessionId).populate("participants.userId", "displayName avatarUrl");
}

async function getActiveQuestionCount() {
  const questionLists = await QuestionList.find({ isActive: true }).select("questionList");
  return questionLists.reduce((total, questionList) => total + questionList.questionList.length, 0);
}

function parseCapacity(rawValue) {
  const maxParticipants = Number(rawValue);

  if (!Number.isInteger(maxParticipants) || maxParticipants < 2 || maxParticipants > 50) {
    return null;
  }

  return maxParticipants;
}

function parseSessionStatus(rawValue) {
  if (typeof rawValue !== "string") {
    return null;
  }

  const normalizedStatus = rawValue.trim().toLowerCase();

  if (!SESSION_STATUSES.includes(normalizedStatus)) {
    return null;
  }

  return normalizedStatus;
}

async function createSession(req, res) {
  const maxParticipants = parseCapacity(req.body.maxParticipants);
  const roomDisplayName = parseRoomDisplayName(req.body.roomDisplayName);

  if (!maxParticipants) {
    return res.status(400).json({ message: "Max participants must be an integer between 2 and 50." });
  }

  if (!roomDisplayName) {
    return res.status(400).json({
      message: `Room display name is required and must be ${ROOM_DISPLAY_NAME_MAX_LENGTH} characters or fewer.`,
    });
  }

  try {
    const sessionCode = await createUniqueSessionCode();
    const joinUrl = `${APP_BASE_URL}/join/${sessionCode}`;
    const session = await Session.create({
      hostUserId: req.userId,
      sessionCode,
      joinUrl,
      maxParticipants,
      participants: [
        {
          userId: req.userId,
          role: "host",
          roomDisplayName,
        },
      ],
    });

    const populatedSession = await fetchSessionById(session._id);
    return res.status(201).json({ session: serializeSession(populatedSession, req.userId) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to create room.";
    return res.status(500).json({ message });
  }
}

async function getMySessions(req, res) {
  const sessions = await Session.find({
    "participants.userId": req.userId,
  })
    .sort({ updatedAt: -1 })
    .populate("participants.userId", "displayName avatarUrl");

  return res.json({
    sessions: sessions.map((session) => serializeSession(session, req.userId)),
  });
}

async function getSessionByCode(req, res) {
  const sessionCode = req.params.sessionCode?.trim()?.toUpperCase();

  if (!sessionCode) {
    return res.status(400).json({ message: "Session code is required." });
  }

  const session = await fetchSession({ sessionCode, "participants.userId": req.userId });

  if (!session) {
    return res.status(404).json({ message: "Room not found or you are not a participant." });
  }

  return res.json({ session: serializeSession(session, req.userId) });
}

async function joinSession(req, res) {
  const sessionCode = req.body.sessionCode?.trim()?.toUpperCase();
  const roomDisplayName = parseRoomDisplayName(req.body.roomDisplayName);

  if (!sessionCode) {
    return res.status(400).json({ message: "Session code is required." });
  }

  if (!roomDisplayName) {
    return res.status(400).json({
      message: `Room display name is required and must be ${ROOM_DISPLAY_NAME_MAX_LENGTH} characters or fewer.`,
    });
  }

  const session = await fetchSession({ sessionCode });

  if (!session) {
    return res.status(404).json({ message: "Room not found." });
  }

  if (session.status !== "waiting") {
    return res.status(409).json({ message: "This room is no longer open for new participants." });
  }

  const alreadyJoined = session.participants.some(
    (participant) => getUserIdValue(participant.userId) === req.userId
  );

  if (!alreadyJoined && session.participants.length >= session.maxParticipants) {
    return res.status(409).json({ message: "This room is already full." });
  }

  if (!alreadyJoined) {
    session.participants.push({
      userId: req.userId,
      role: "member",
      roomDisplayName,
    });
    await session.save();
  }

  return res.json({ session: serializeSession(session, req.userId) });
}

async function updateMySessionProfile(req, res) {
  const roomDisplayName = parseRoomDisplayName(req.body.roomDisplayName);

  if (!roomDisplayName) {
    return res.status(400).json({
      message: `Room display name is required and must be ${ROOM_DISPLAY_NAME_MAX_LENGTH} characters or fewer.`,
    });
  }

  const session = await fetchSessionById(req.params.sessionId);

  if (!session) {
    return res.status(404).json({ message: "Room not found." });
  }

  const currentParticipant = session.participants.find(
    (participant) => getUserIdValue(participant.userId) === req.userId
  );

  if (!currentParticipant) {
    return res.status(403).json({ message: "You are not a participant in this room." });
  }

  currentParticipant.roomDisplayName = roomDisplayName;
  await session.save();

  return res.json({ session: serializeSession(session, req.userId) });
}

async function updateSession(req, res) {
  const maxParticipants = parseCapacity(req.body.maxParticipants);

  if (!maxParticipants) {
    return res.status(400).json({ message: "Max participants must be an integer between 2 and 50." });
  }

  const session = await fetchSessionById(req.params.sessionId);

  if (!session) {
    return res.status(404).json({ message: "Room not found." });
  }

  if (session.hostUserId.toString() !== req.userId) {
    return res.status(403).json({ message: "Only the room creator can update this room." });
  }

  if (maxParticipants < session.participants.length) {
    return res.status(400).json({
      message: `Max participants cannot be lower than the current participant count (${session.participants.length}).`,
    });
  }

  session.maxParticipants = maxParticipants;
  await session.save();

  return res.json({ session: serializeSession(session, req.userId) });
}

async function deleteSession(req, res) {
  const session = await fetchSessionById(req.params.sessionId);

  if (!session) {
    return res.status(404).json({ message: "Room not found." });
  }

  if (session.hostUserId.toString() !== req.userId) {
    return res.status(403).json({ message: "Only the room creator can delete this room." });
  }

  await session.deleteOne();

  return res.status(204).send();
}

async function updateSessionStatus(req, res) {
  const status = parseSessionStatus(req.body.status);

  if (!status) {
    return res.status(400).json({
      message: `Status must be one of: ${SESSION_STATUSES.join(", ")}.`,
    });
  }

  const session = await fetchSessionById(req.params.sessionId);

  if (!session) {
    return res.status(404).json({ message: "Room not found." });
  }

  if (session.hostUserId.toString() !== req.userId) {
    return res.status(403).json({ message: "Only the room creator can update the room status." });
  }

  session.status = status;
  await session.save();

  return res.json({ session: serializeSession(session, req.userId) });
}

async function getSessionProgress(req, res) {
  const session = await fetchSessionById(req.params.sessionId);

  if (!session) {
    return res.status(404).json({ message: "Room not found." });
  }

  const isParticipant = session.participants.some(
    (participant) => getUserIdValue(participant.userId) === req.userId
  );

  if (!isParticipant) {
    return res.status(403).json({ message: "You are not a participant in this room." });
  }

  const [totalQuestions, responseCounts] = await Promise.all([
    getActiveQuestionCount(),
    Response.aggregate([
      { $match: { sessionId: session._id.toString() } },
      { $group: { _id: "$userId", answeredCount: { $sum: 1 } } },
    ]),
  ]);

  const responseCountByUserId = new Map(
    responseCounts.map((entry) => [entry._id, entry.answeredCount])
  );

  const participants = session.participants.map((participant) => {
    const userId = getUserIdValue(participant.userId);
    const answeredCount = responseCountByUserId.get(userId) || 0;
    const isComplete = totalQuestions > 0 && answeredCount >= totalQuestions;

    return {
      userId,
      roomDisplayName: participant.roomDisplayName,
      answeredCount,
      isComplete,
    };
  });

  const completedCount = participants.filter((participant) => participant.isComplete).length;
  const pendingCount = Math.max(session.participants.length - completedCount, 0);

  return res.json({
    progress: {
      sessionId: session._id.toString(),
      totalParticipants: session.participants.length,
      totalQuestions,
      completedCount,
      pendingCount,
      allComplete: pendingCount === 0 && totalQuestions > 0,
      participants,
    },
  });
}

module.exports = {
  createSession,
  deleteSession,
  getMySessions,
  getSessionProgress,
  getSessionByCode,
  joinSession,
  updateSessionStatus,
  updateMySessionProfile,
  updateSession,
};
