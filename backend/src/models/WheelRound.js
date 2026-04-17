const mongoose = require("mongoose");

const wheelItemSchema = new mongoose.Schema(
  {
    recommendationSetId: {
      type: String,
      required: true,
      trim: true,
    },
    placeId: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false },
);

const wheelRoundSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    wheelItems: {
      type: [wheelItemSchema],
      default: [],
    },
    resultPlaceId: {
      type: String,
      default: null,
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "spinning", "completed"],
      default: "pending",
    },
  },
  {
    collection: "wheelRounds",
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

module.exports = mongoose.model("WheelRound", wheelRoundSchema);
