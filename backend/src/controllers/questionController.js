const QuestionList = require("../models/QuestionList");

function pickRandomQuestion(questions) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * questions.length);
  return questions[randomIndex];
}

function serializeQuestion(question) {
  return {
    questionId: question.questionId,
    questionType: question.questionType,
    questionText: question.questionText,
    questionValue: (question.questionValue || []).map((option) => ({
      optionLabel: option.optionLabel,
      optionText: option.optionText,
    })),
  };
}

function serializeQuestionList(questionList) {
  const randomQuestion = pickRandomQuestion(questionList.questionList);

  return {
    questionListId: questionList.questionListId,
    category: questionList.category,
    isActive: questionList.isActive,
    questionList: randomQuestion ? [serializeQuestion(randomQuestion)] : [],
  };
}

async function getActiveQuestionLists(req, res) {
  try {
    const questionLists = await QuestionList.find({ isActive: true }).sort({ _id: 1 });

    return res.json({
      questionLists: questionLists.map(serializeQuestionList),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch active question lists.";
    return res.status(500).json({ message });
  }
}

module.exports = {
  getActiveQuestionLists,
};
