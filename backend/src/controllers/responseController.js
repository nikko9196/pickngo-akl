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
  const questionLists = await QuestionList.find({ isActive: true }).select("questionList");
  return questionLists.reduce((total, questionList) => total + questionList.questionList.length, 0);
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

  return res.status(201).json({
    response: {
      sessionId: response.sessionId,
      userId: response.userId,
      questionId: response.questionId,
      answer: response.answer,
      skipped: response.skipped,
      createdAt: response.createdAt,
    },
  });
}

module.exports = {
  upsertResponse,
};
