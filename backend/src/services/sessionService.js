const Session = require("../models/Session");

async function findSessionById(sessionId) {
  if (!sessionId) {
    const error = new Error("Session ID is required.");
    error.statusCode = 400;
    throw error;
  }

  const session = await Session.findById(sessionId);

  if (!session) {
    const error = new Error("Session not found.");
    error.statusCode = 404;
    throw error;
  }

  return session;
}

function checkValidParticipant(session, userId) {
  const isParticipant = session.participants.some(
    (p) => p.userId.toString() === userId,
  );

  if (!isParticipant) {
    const error = new Error("You are not a participant in this session.");
    error.statusCode = 403;
    throw error;
  }
}

function checkSessionStatus(session, expectedStatus) {
  if (session.status !== expectedStatus) {
    const error = new Error(`Session is not in ${expectedStatus} state.`);
    error.statusCode = 400;
    throw error;
  }
}

function checkValidHost(
  session,
  userId,
  message = "Only the host can perform this action.",
) {
  if (session.hostUserId.toString() !== userId) {
    const error = new Error(message);
    error.statusCode = 403;
    throw error;
  }
}

async function findSessionByCode(sessionCode) {
  if (!sessionCode) {
    const error = new Error("Session code is required.");
    error.statusCode = 400;
    throw error;
  }

  const session = await Session.findOne({ sessionCode: sessionCode.toUpperCase() });

  if (!session) {
    const error = new Error("Session not found.");
    error.statusCode = 404;
    throw error;
  }

  return session;
}

module.exports = {
  findSessionById,
  // findSessionByIdFresh,
  checkValidParticipant,
  checkSessionStatus,
  checkValidHost,
  findSessionByCode,
};
