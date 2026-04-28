const mongoose = require("mongoose");

const groupPreferenceSchema = new mongoose.Schema(
  {
    topCuisines: {
      type: [String],
      default: [],
    },
    preferredPrice: {
      type: String,
      default: "",
      trim: true,
    },
    dietary: {
      type: [String],
      default: [],
    },
    exclude: {
      type: [String],
      default: [],
    },
    coffeePreference: {
      type: String,
      default: "",
      trim: true,
    },
    openLatePreference: {
      type: String,
      default: "",
      trim: true,
    },
    serviceMode: {
      type: String,
      default: "",
      trim: true,
    },
    specialRequestKeywords: {
      type: [String],
      default: [],
    },
    maxDistanceKm: {
      type: Number,
      default: null,
    },
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
  },
  { _id: false }
);

const restaurantSchema = new mongoose.Schema(
  {
    placeId: {
      type: String,
      default: "",
      trim: true,
    },
    restaurantId: {
      type: String,
      default: "",
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
    userRatingCount: {
      type: Number,
      default: 0,
    },
    priceLevelRaw: {
      type: String,
      default: "",
      trim: true,
    },
    priceLevel: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    primaryType: {
      type: String,
      default: "",
      trim: true,
    },
    types: {
      type: [String],
      default: [],
    },
    cuisine: {
      type: [String],
      default: [],
    },
    photos: {
      type: [String],
      default: [],
    },
    openNow: {
      type: Boolean,
      default: false,
    },
    latitude: {
      type: Number,
      default: null,
    },
    longitude: {
      type: Number,
      default: null,
    },
    mapsUrl: {
      type: String,
      default: "",
      trim: true,
    },
    distanceKm: {
      type: Number,
      default: null,
    },
    distance: {
      type: Number,
      default: null,
    },
    score: {
      type: Number,
      default: 0,
    },
    reasons: {
      type: [String],
      default: [],
    },
  },
  { _id: false }
);

const recommendationSnapshotSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      required: true,
      index: true,
    },
    generatedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    groupPrefs: {
      type: groupPreferenceSchema,
      required: true,
    },
    restaurants: {
      type: [restaurantSchema],
      default: [],
    },
  },
  {
    collection: "recommendationSnapshots",
    versionKey: false,
  }
);

recommendationSnapshotSchema.index({ sessionId: 1, generatedAt: -1 });

module.exports = mongoose.model("RecommendationSnapshot", recommendationSnapshotSchema);
