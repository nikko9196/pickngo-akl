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
  const questionLists = await QuestionList.find({ isActive: true }).sort({ _id: 1 });

  return res.json({
    questionLists: questionLists.map(serializeQuestionList),
  });
}

module.exports = {
  getActiveQuestionLists,
};
