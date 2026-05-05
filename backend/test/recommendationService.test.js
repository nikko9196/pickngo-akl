const test = require("node:test");
const assert = require("node:assert/strict");
const mongoose = require("mongoose");

const RecommendationSnapshot = require("../src/models/RecommendationSnapshot");
const Session = require("../src/models/Session");
const {
  generateRecommendationsForSession,
  getLatestRecommendationsForSession,
} = require("../src/services/recommendationService");

function mockSessionLookup(t, session) {
  t.mock.method(Session, "findById", () => ({
    select: async () => session,
  }));
}

function mockLatestSnapshotLookup(t, snapshot) {
  t.mock.method(RecommendationSnapshot, "findOne", () => ({
    sort: async () => snapshot,
  }));
}

test("getLatestRecommendationsForSession returns a clean empty state when no snapshot exists", async (t) => {
  const sessionId = new mongoose.Types.ObjectId();

  mockSessionLookup(t, {
    _id: sessionId,
    status: "generating",
    participants: [{ userId: "user-1" }],
  });
  mockLatestSnapshotLookup(t, null);

  const result = await getLatestRecommendationsForSession({
    sessionId: sessionId.toString(),
    requesterUserId: "user-1",
  });

  assert.equal(result.message, "No recommendation snapshot has been generated yet.");
  assert.equal(result.snapshot, null);
  assert.equal(result.sessionStatus, "generating");
});

test("generateRecommendationsForSession reuses a fresh cached snapshot before hitting Google", async (t) => {
  const sessionId = new mongoose.Types.ObjectId();
  const generatedAt = new Date();

  mockSessionLookup(t, {
    _id: sessionId,
    status: "generating",
    participants: [{ userId: "user-1" }],
  });
  mockLatestSnapshotLookup(t, {
    generatedAt,
    toObject() {
      return {
        sessionId: sessionId.toString(),
        generatedAt,
        restaurants: [
          {
            placeId: "place-1",
            name: "Tanuki's Cave",
            address: "319 Queen Street, Auckland CBD",
            district: "Auckland CBD",
            location: { lat: -36.8515, lng: 174.7645 },
            rating: 4.5,
            priceLevel: 2,
            cuisine: ["Japanese"],
            photos: [],
            distance: 0.5,
            openNow: true,
          },
        ],
      };
    },
  });

  const result = await generateRecommendationsForSession({
    sessionId: sessionId.toString(),
    requesterUserId: "user-1",
  });

  assert.equal(result.cached, true);
  assert.equal(result.message, "Returning the most recent recommendation snapshot.");
  assert.equal(result.sessionStatus, "generating");
  assert.equal(result.snapshot.restaurants.length, 1);
  assert.equal(result.snapshot.restaurants[0].name, "Tanuki's Cave");
});
