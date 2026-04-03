const mongoose = require("mongoose");

const authProviderSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ["local", "google"],
      required: true,
    },
    providerUserId: {
      type: String,
      default: null,
    },
    passwordHash: {
      type: String,
      default: null,
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    displayName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    avatarUrl: {
      type: String,
      default: "",
    },
    authProviders: {
      type: [authProviderSchema],
      default: [],
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
