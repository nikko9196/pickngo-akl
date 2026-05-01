const mongoose = require("mongoose");
const MAX_SELECTIONS_PER_USER_DEFAULT = 3;

const participantSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    role: {
      type: String,
      enum: ["host", "member"],
      required: true,
    },
    roomDisplayName: {
      type: String,
      required: true,
      trim: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    isReady: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false },
);

const wheelItemSchema = new mongoose.Schema(
  {
    recommendationSnapshotId: {
      type: String,
      required: true,
      trim: true,
    },
    placeId: {
      type: String,
      required: true,
      trim: true,
    },
    userId: {
      type: String,
      default: "",
      trim: true,
    },
    roomDisplayName: {
      type: String,
      default: "",
      trim: true,
    },
  },
  { _id: false },
);

const wheelResultSchema = new mongoose.Schema(
  {
    recommendationSnapshotId: {
      type: String,
      trim: true,
    },
    placeId: {
      type: String,
      trim: true,
    },
  },
  { _id: false },
);

const sessionSchema = new mongoose.Schema(
  {
    hostUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    sessionCode: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    joinUrl: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: [
        "waiting",
        "questioning",
        "generating",
        "selecting",
        "spinning",
        "voting",
        "completed",
      ],
      default: "waiting",
    },
    maxParticipants: {
      type: Number,
      required: true,
      min: 2,
      max: 50,
    },
    maxSelectionsPerUser: {
      type: Number,
      required: true,
      min: 1,
      max: 10,
      default: MAX_SELECTIONS_PER_USER_DEFAULT,
    },
    participants: {
      type: [participantSchema],
      default: [],
    },
    wheelItems: {
      type: [wheelItemSchema],
      default: [],
    },
    currentWheelResult: {
      type: wheelResultSchema,
      default: null,
    },
    finalWheelResult: {
      type: wheelResultSchema,
      default: null,
    },
    voteSummary: {
      type: new mongoose.Schema(
        {
          acceptCount: {
            type: Number,
            default: 0,
            min: 0,
          },
          respinCount: {
            type: Number,
            default: 0,
            min: 0,
          },
          votedUserIds: {
            type: [String],
            default: [],
          },
        },
        { _id: false },
      ),
      default: () => ({
        acceptCount: 0,
        respinCount: 0,
        votedUserIds: [],
      }),
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Session", sessionSchema);
