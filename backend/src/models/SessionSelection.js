const mongoose = require("mongoose");

const selectionRestaurantSchema = new mongoose.Schema(
  {
    placeId: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      default: "",
      trim: true,
    },
    address: {
      type: String,
      default: "",
      trim: true,
    },
    district: {
      type: String,
      default: "",
      trim: true,
    },
    location: {
      lat: {
        type: Number,
        default: null,
      },
      lng: {
        type: Number,
        default: null,
      },
    },
    rating: {
      type: Number,
      default: null,
    },
    priceLevel: {
      type: Number,
      default: null,
    },
    cuisine: {
      type: [String],
      default: [],
    },
    distance: {
      type: Number,
      default: null,
    },
    openNow: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false }
);

const sessionSelectionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    recommendationSnapshotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RecommendationSnapshot",
      required: true,
      index: true,
    },
    selections: {
      type: [selectionRestaurantSchema],
      default: [],
    },
  },
  {
    collection: "sessionSelections",
    timestamps: { createdAt: "submittedAt", updatedAt: true },
    versionKey: false,
  }
);

sessionSelectionSchema.index({ sessionId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model("SessionSelection", sessionSelectionSchema);
