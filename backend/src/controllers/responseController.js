const Response = require("../models/Response");
const Session = require("../models/Session");
const QuestionList = require("../models/QuestionList");

function parseAnswer(rawValue) {
  if (typeof rawValue !== "string") {
    return "";
  }

  return rawValue.trim();
}

async function getActiveQuestionCount() {
  return QuestionList.countDocuments({
    isActive: true,
    "questionList.0": { $exists: true },
  });
}

async function updateSessionStatusIfComplete(sessionId) {
  const session = await Session.findById(sessionId).select("status participants");

  if (!session || session.status !== "questioning") {
    return;
  }

  const totalQuestions = await getActiveQuestionCount();

  if (totalQuestions === 0) {
    return;
  }

  const responseCounts = await Response.aggregate([
    { $match: { sessionId } },
    { $group: { _id: "$userId", answeredCount: { $sum: 1 } } },
  ]);

  const responseCountByUserId = new Map(
    responseCounts.map((entry) => [entry._id, entry.answeredCount])
  );

  const allParticipantsComplete = session.participants.every((participant) => {
    const userId = participant.userId.toString();
    return (responseCountByUserId.get(userId) || 0) >= totalQuestions;
  });

  if (!allParticipantsComplete) {
    return;
  }

  session.status = "generating";
  await session.save();
}

async function upsertResponse(req, res) {
  const sessionId = req.params.sessionId?.trim();
  const questionId = req.body.questionId?.trim();
  const answer = parseAnswer(req.body.answer);
  const skipped = Boolean(req.body.skipped);

  if (!sessionId) {
    return res.status(400).json({ message: "Session ID is required." });
  }

  if (!questionId) {
    return res.status(400).json({ message: "Question ID is required." });
  }

  if (!skipped && !answer) {
    return res.status(400).json({ message: "Answer is required unless the question is skipped." });
  }

  try {
    const response = await Response.findOneAndUpdate(
      {
        sessionId,
        userId: req.userId,
        questionId,
      },
      {
        $set: {
          answer: skipped ? "" : answer,
          skipped,
        },
        $setOnInsert: {
          sessionId,
          userId: req.userId,
          questionId,
        },
      },
      {
        returnDocument: "after",
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      }
    );

    await updateSessionStatusIfComplete(sessionId);

    return res.status(200).json({
      response: {
        sessionId: response.sessionId,
        userId: response.userId,
        questionId: response.questionId,
        answer: response.answer,
        skipped: response.skipped,
        createdAt: response.createdAt,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save response.";
    return res.status(500).json({ message });
  }
}

async function getMyResponses(req, res) {
  const sessionId = req.params.sessionId?.trim();

  if (!sessionId) {
    return res.status(400).json({ message: "Session ID is required." });
  }

  try {
    const responses = await Response.find({
      sessionId,
      userId: req.userId,
    })
      .sort({ createdAt: 1 })
      .lean();

    return res.status(200).json({
      responses: responses.map((response) => ({
        sessionId: response.sessionId,
        userId: response.userId,
        questionId: response.questionId,
        answer: response.answer,
        skipped: response.skipped,
        createdAt: response.createdAt,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch responses.";
    return res.status(500).json({ message });
  }
}

module.exports = {
  getMyResponses,
  upsertResponse,
};
