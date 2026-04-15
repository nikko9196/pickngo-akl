const mongoose = require("mongoose");

const optionSchema = new mongoose.Schema(
  {
    optionLabel: {
      type: String,
      trim: true,
    },
    optionText: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false }
);

const questionSchema = new mongoose.Schema(
  {
    questionId: {
      type: String,
      required: true,
      trim: true,
    },
    questionType: {
      type: String,
      required: true,
      trim: true,
    },
    questionText: {
      type: String,
      required: true,
      trim: true,
    },
    questionValue: {
      type: [optionSchema],
      default: undefined,
    },
  },
  { _id: false }
);

const questionListSchema = new mongoose.Schema(
  {
    questionListId: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    questionList: {
      type: [questionSchema],
      default: [],
    },
  },
  {
    collection: "questionLists",
    versionKey: false,
  }
);

module.exports = mongoose.model("QuestionList", questionListSchema);
