const mongoose = require("mongoose");

const selectedItemSchema = new mongoose.Schema(
  {
    placeId: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { _id: false },
);

const userSelectionsSchema = new mongoose.Schema(
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
    recommendationSetId: {
      type: String,
      required: true,
      index: true,
      trim: true,
    },
    selectedItems: {
      type: [selectedItemSchema],
      default: [],
    },
  },
  {
    collection: "userSelections",
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  },
);

userSelectionsSchema.index({ sessionId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("UserSelection", userSelectionsSchema);
