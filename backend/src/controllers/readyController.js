const {
  findSessionById,
  checkValidParticipant,
  checkValidHost,
} = require("../services/sessionService");
const { getErrorStatus } = require("../utils/errorUtils");

function getReadySummary(session) {
  const participants = session.participants.map((participant) => ({
    userId: participant.userId.toString(),
    role: participant.role,
    roomDisplayName: participant.roomDisplayName,
    isReady: participant.isReady,
  }));

  const readyCount = participants.filter(
    (participant) => participant.isReady,
  ).length;

  return {
    sessionId: session._id.toString(),
    readyCount,
    totalParticipants: session.participants.length,
    allReady: readyCount === session.participants.length,
    participants,
  };
}

// USER: Mark as READY:
async function markReady(req, res) {
  const sessionId = req.params.sessionId?.trim();

  try {
    const session = await findSessionById(sessionId);
    checkValidParticipant(session, req.userId);

    const participant = session.participants.find(
      (p) => p.userId.toString() === req.userId,
    );

    participant.isReady = true;

    const allReady = session.participants.every(
      (participant) => participant.isReady,
    );

    if (allReady) {
      session.status = "spinning";
    }

    await session.save();

    return res.status(200).json({
      message: "User is ready.",
      readySummary: getReadySummary(session),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to mark user as ready.";
    return res.status(getErrorStatus(error)).json({ message });
  }
}

// HOST: Send Reminder:
async function sendReminder(req, res) {
  const sessionId = req.params.sessionId?.trim();

  try {
    const session = await findSessionById(sessionId);

    checkValidHost(session, req.userId, "Only the host can send reminders.");

    const waitingParticipants = session.participants.filter(
      (participant) => !participant.isReady,
    );

    session.remindedUserIds = waitingParticipants.map((participant) =>
      participant.userId.toString(),
    );

    await session.save();

    return res.status(200).json({
      message: "Reminder sent to waiting users.",
      remindedUserIds: session.remindedUserIds,
      readySummary: getReadySummary(session),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to send reminder.";
    return res.status(getErrorStatus(error)).json({ message });
  }
}

// SET READY STATUS FOR ALL:
async function markAllReady(req, res) {
  const sessionId = req.params.sessionId?.trim();

  try {
    const session = await findSessionById(sessionId);

    checkValidHost(
      session,
      req.userId,
      "Only the host can mark all users as ready.",
    );

    session.participants.forEach((participant) => {
      participant.isReady = true;
    });

    session.status = "spinning";

    await session.save();

    return res.status(200).json({
      message: "All users are ready.",
      readySummary: getReadySummary(session),
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to mark all users as ready.";
    return res.status(getErrorStatus(error)).json({ message });
  }
}

// GET READY STATUS: Retrieves the current ready state of the session for all participants.
async function getReadyStatus(req, res) {
  const sessionId = req.params.sessionId?.trim();

  try {
    const session = await findSessionById(sessionId);
    checkValidParticipant(session, req.userId);

    return res.status(200).json({
      readySummary: getReadySummary(session),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch ready status.";
    return res.status(getErrorStatus(error)).json({ message });
  }
}

// GET REMINDER:
async function getReminder(req, res) {
  const sessionId = req.params.sessionId?.trim();

  try {
    const session = await findSessionById(sessionId);
    checkValidParticipant(session, req.userId);

    return res.status(200).json({
      message: "Reminder status retrieved.",
      remindedUserIds: session.remindedUserIds || [],
      readySummary: getReadySummary(session),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to get reminder.";
    return res.status(getErrorStatus(error)).json({ message });
  }
}

module.exports = {
  markReady,
  sendReminder,
  getReadyStatus,
  markAllReady,
  getReminder,
};
