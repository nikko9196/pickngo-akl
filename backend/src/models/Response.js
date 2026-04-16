const mongoose = require("mongoose");

const responseSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    userId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    questionId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    answer: {
      type: String,
      default: "",
      trim: true,
    },
    skipped: {
      type: Boolean,
      default: false,
    },
  },
  {
    collection: "responses",
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

responseSchema.index({ sessionId: 1, userId: 1, questionId: 1 }, { unique: true });

module.exports = mongoose.model("Response", responseSchema);
