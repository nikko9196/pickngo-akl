const QuestionList = require("../models/QuestionList");

function serializeQuestionList(questionList) {
  return {
    questionListId: questionList.questionListId,
    category: questionList.category,
    isActive: questionList.isActive,
    questionList: questionList.questionList.map((question) => ({
      questionId: question.questionId,
      questionType: question.questionType,
      questionText: question.questionText,
      questionValue: (question.questionValue || []).map((option) => ({
        optionLabel: option.optionLabel,
        optionText: option.optionText,
      })),
    })),
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
