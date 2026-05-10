const mongoose = require("mongoose");

const QuestionList = require("../../../models/QuestionList");
const RecommendationSnapshot = require("../../../models/RecommendationSnapshot");
const Response = require("../../../models/Response");
const Session = require("../../../models/Session");
const {
  DEFAULT_GROUP_LOCATION,
  DEFAULT_MAX_DISTANCE_KM,
} = require("../../../config/recommendationQuestionMap");
const {
  generateRecommendationsForSession,
  getLatestRecommendationsForSession,
} = require("../../../services/recommendationService");

const SESSION_LOCATION = {
  source: "map",
  label: "UOA",
  lat: -36.8502,
  lng: 174.7681,
  radiusMeters: 8000,
};

function mockSessionLookup(session) {
  jest.spyOn(Session, "findById").mockReturnValue({
    select: jest.fn().mockResolvedValue(session),
  });
}

function mockLatestSnapshotLookup(snapshot) {
  jest.spyOn(RecommendationSnapshot, "findOne").mockReturnValue({
    sort: jest.fn().mockResolvedValue(snapshot),
  });
}

function mockResponseLookup(responses) {
  jest.spyOn(Response, "find").mockReturnValue({
    sort: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(responses),
    }),
  });
}

function mockQuestionLookup(questionLists) {
  jest.spyOn(QuestionList, "find").mockReturnValue({
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(questionLists),
    }),
  });
}

afterEach(() => {
  jest.restoreAllMocks();
  delete global.fetch;
  delete process.env.GOOGLE_PLACES_API_KEY;
});

test("getLatestRecommendationsForSession returns a clean empty state when no snapshot exists", async () => {
  const sessionId = new mongoose.Types.ObjectId();

  mockSessionLookup({
    _id: sessionId,
    status: "generating",
    participants: [{ userId: "user-1" }],
  });
  mockLatestSnapshotLookup(null);

  const result = await getLatestRecommendationsForSession({
    sessionId: sessionId.toString(),
    requesterUserId: "user-1",
  });

  expect(result.message).toBe("No recommendation snapshot has been generated yet.");
  expect(result.snapshot).toBeNull();
  expect(result.sessionStatus).toBe("generating");
});

test("generateRecommendationsForSession reuses a fresh cached snapshot before hitting Google", async () => {
  const sessionId = new mongoose.Types.ObjectId();
  const generatedAt = new Date();

  mockSessionLookup({
    _id: sessionId,
    status: "generating",
    participants: [{ userId: "user-1" }],
  });
  mockLatestSnapshotLookup({
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

  expect(result.cached).toBe(true);
  expect(result.message).toBe("Returning the most recent recommendation snapshot.");
  expect(result.sessionStatus).toBe("generating");
  expect(result.snapshot.restaurants).toHaveLength(1);
  expect(result.snapshot.restaurants[0].name).toBe("Tanuki's Cave");
});

test("generateRecommendationsForSession falls back to neutral location-based recommendations when there are no responses", async () => {
  const sessionId = new mongoose.Types.ObjectId();
  const session = {
    _id: sessionId,
    status: "generating",
    participants: [{ userId: "user-1" }],
    location: SESSION_LOCATION,
    save: jest.fn().mockResolvedValue(true),
  };
  const generatedAt = new Date();

  mockSessionLookup(session);
  mockLatestSnapshotLookup(null);
  mockResponseLookup([]);
  jest.spyOn(RecommendationSnapshot, "create").mockResolvedValue({
    toObject() {
      return {
        sessionId: sessionId.toString(),
        generatedAt,
        groupPrefs: {
          topCuisines: [],
          preferredPrice: "",
          dietary: [],
          exclude: [],
          coffeePreference: "",
          openLatePreference: "",
          serviceMode: "",
          specialRequestKeywords: [],
          maxDistanceKm: DEFAULT_MAX_DISTANCE_KM,
          latitude: DEFAULT_GROUP_LOCATION.latitude,
          longitude: DEFAULT_GROUP_LOCATION.longitude,
        },
        restaurants: [
          {
            placeId: "place-fallback",
            name: "Fallback Sushi",
            address: "1 Queen Street, Auckland CBD",
            district: "Auckland CBD",
            location: { lat: -36.848, lng: 174.764 },
            rating: 4.6,
            priceLevel: 2,
            cuisine: ["Japanese"],
            photos: [],
            distance: 0.2,
            openNow: true,
          },
        ],
      };
    },
  });

  process.env.GOOGLE_PLACES_API_KEY = "test-api-key";
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    text: async () =>
      JSON.stringify({
        places: [
          {
            id: "place-fallback",
            displayName: { text: "Fallback Sushi" },
            formattedAddress: "1 Queen Street, Auckland CBD",
            location: { latitude: -36.848, longitude: 174.764 },
            rating: 4.6,
            userRatingCount: 210,
            priceLevel: "PRICE_LEVEL_MODERATE",
            primaryType: "japanese_restaurant",
            types: ["restaurant", "japanese_restaurant"],
            googleMapsUri: "https://maps.google.com/example",
            photos: [],
            currentOpeningHours: { openNow: true },
          },
        ],
      }),
  });

  const result = await generateRecommendationsForSession({
    sessionId: sessionId.toString(),
    requesterUserId: "user-1",
    refresh: true,
  });

  expect(global.fetch).toHaveBeenCalledTimes(1);
  const fetchPayload = JSON.parse(global.fetch.mock.calls[0][1].body);
  expect(fetchPayload.textQuery).toBe("restaurant");
  expect(fetchPayload.locationBias.circle.center).toEqual({
    latitude: SESSION_LOCATION.lat,
    longitude: SESSION_LOCATION.lng,
  });
  expect(fetchPayload.locationBias.circle.radius).toBe(SESSION_LOCATION.radiusMeters);
  expect(result.usedFallback).toBe(true);
  expect(result.fallbackReason).toBe("no_usable_responses");
  expect(result.message).toBe(
    "Generated fallback location-based recommendations because no usable questionnaire responses were available."
  );
  expect(result.snapshot.restaurants).toHaveLength(1);
  expect(result.sessionStatus).toBe("selecting");
  expect(session.save).toHaveBeenCalledTimes(1);
});

test("generateRecommendationsForSession falls back when responses exist but none are usable", async () => {
  const sessionId = new mongoose.Types.ObjectId();
  const session = {
    _id: sessionId,
    status: "generating",
    participants: [{ userId: "user-1" }],
    location: SESSION_LOCATION,
    save: jest.fn().mockResolvedValue(true),
  };
  const generatedAt = new Date();

  mockSessionLookup(session);
  mockLatestSnapshotLookup(null);
  mockResponseLookup([
    {
      userId: "user-1",
      questionId: "q_budget_1",
      answer: "",
      skipped: true,
    },
  ]);
  mockQuestionLookup([
    {
      category: "budget",
      questionList: [{ questionId: "q_budget_1", questionType: "single_choice" }],
    },
  ]);
  jest.spyOn(RecommendationSnapshot, "create").mockResolvedValue({
    toObject() {
      return {
        sessionId: sessionId.toString(),
        generatedAt,
        groupPrefs: {
          topCuisines: [],
          preferredPrice: "",
          dietary: [],
          exclude: [],
          coffeePreference: "",
          openLatePreference: "",
          serviceMode: "",
          specialRequestKeywords: [],
          maxDistanceKm: DEFAULT_MAX_DISTANCE_KM,
          latitude: DEFAULT_GROUP_LOCATION.latitude,
          longitude: DEFAULT_GROUP_LOCATION.longitude,
        },
        restaurants: [],
      };
    },
  });

  process.env.GOOGLE_PLACES_API_KEY = "test-api-key";
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    text: async () => JSON.stringify({ places: [] }),
  });

  const result = await generateRecommendationsForSession({
    sessionId: sessionId.toString(),
    requesterUserId: "user-1",
    refresh: true,
  });

  expect(result.usedFallback).toBe(true);
  expect(result.fallbackReason).toBe("no_usable_responses");
  expect(result.message).toBe(
    "No usable questionnaire responses were available, and no nearby fallback recommendations matched."
  );
  expect(result.snapshot.restaurants).toHaveLength(0);
  expect(result.sessionStatus).toBe("generating");
  expect(session.save).not.toHaveBeenCalled();
});

test("generateRecommendationsForSession falls back to nearby alternatives when strict preferences produce no matches", async () => {
  const sessionId = new mongoose.Types.ObjectId();
  const session = {
    _id: sessionId,
    status: "generating",
    participants: [{ userId: "user-1" }],
    location: SESSION_LOCATION,
    save: jest.fn().mockResolvedValue(true),
  };
  const generatedAt = new Date();

  mockSessionLookup(session);
  mockLatestSnapshotLookup(null);
  mockResponseLookup([
    {
      userId: "user-1",
      questionId: "q_cuisine_1",
      answer: "Japanese",
      skipped: false,
    },
    {
      userId: "user-1",
      questionId: "q_budget_1",
      answer: "Expensive ($$$)",
      skipped: false,
    },
    {
      userId: "user-1",
      questionId: "location_coordinates",
      answer: "-36.9000, 174.6500",
      skipped: false,
    },
  ]);
  mockQuestionLookup([
    {
      category: "cuisine",
      questionList: [{ questionId: "q_cuisine_1", questionType: "multiple_choice" }],
    },
    {
      category: "budget",
      questionList: [{ questionId: "q_budget_1", questionType: "single_choice" }],
    },
    {
      category: "location",
      questionList: [{ questionId: "location_coordinates", questionType: "text" }],
    },
  ]);

  const createSnapshot = jest.spyOn(RecommendationSnapshot, "create").mockResolvedValue({
    toObject() {
      return {
        sessionId: sessionId.toString(),
        generatedAt,
        usedFallback: true,
        fallbackReason: "no_matches_for_preferences",
        groupPrefs: {
          topCuisines: ["japanese"],
          preferredPrice: "$$$",
          dietary: [],
          exclude: [],
          coffeePreference: "",
          openLatePreference: "",
          serviceMode: "",
          specialRequestKeywords: [],
          maxDistanceKm: DEFAULT_MAX_DISTANCE_KM,
          latitude: DEFAULT_GROUP_LOCATION.latitude,
          longitude: DEFAULT_GROUP_LOCATION.longitude,
        },
        restaurants: [
          {
            placeId: "place-nearby",
            name: "Nearby Noodles",
            address: "2 Queen Street, Auckland CBD",
            district: "Auckland CBD",
            location: { lat: -36.8482, lng: 174.7644 },
            rating: 4.6,
            priceLevel: 2,
            cuisine: ["Restaurant"],
            photos: [],
            distance: 0.1,
            openNow: true,
          },
        ],
      };
    },
  });

  process.env.GOOGLE_PLACES_API_KEY = "test-api-key";
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          places: [
            {
              id: "strict-place",
              displayName: { text: "Far Cheap Chinese" },
              formattedAddress: "200 Albany Highway, Auckland",
              location: { latitude: -36.75, longitude: 174.7 },
              rating: 3.1,
              userRatingCount: 12,
              priceLevel: "PRICE_LEVEL_INEXPENSIVE",
              primaryType: "chinese_restaurant",
              types: ["restaurant", "chinese_restaurant"],
              googleMapsUri: "https://maps.google.com/strict",
              photos: [],
              currentOpeningHours: { openNow: true },
            },
          ],
        }),
    })
    .mockResolvedValueOnce({
      ok: true,
      text: async () =>
        JSON.stringify({
          places: [
            {
              id: "place-nearby",
              displayName: { text: "Nearby Noodles" },
              formattedAddress: "2 Queen Street, Auckland CBD",
              location: { latitude: -36.8482, longitude: 174.7644 },
              rating: 4.6,
              userRatingCount: 250,
              priceLevel: "PRICE_LEVEL_MODERATE",
              primaryType: "restaurant",
              types: ["restaurant"],
              googleMapsUri: "https://maps.google.com/nearby",
              photos: [],
              currentOpeningHours: { openNow: true },
            },
          ],
        }),
    });

  const result = await generateRecommendationsForSession({
    sessionId: sessionId.toString(),
    requesterUserId: "user-1",
    refresh: true,
  });

  expect(global.fetch).toHaveBeenCalledTimes(2);
  const strictPayload = JSON.parse(global.fetch.mock.calls[0][1].body);
  const fallbackPayload = JSON.parse(global.fetch.mock.calls[1][1].body);
  expect(strictPayload.textQuery).toBe("japanese restaurant");
  expect(strictPayload.locationBias.circle.center).toEqual({
    latitude: SESSION_LOCATION.lat,
    longitude: SESSION_LOCATION.lng,
  });
  expect(strictPayload.locationBias.circle.radius).toBe(SESSION_LOCATION.radiusMeters);
  expect(fallbackPayload.textQuery).toBe("restaurant");
  expect(fallbackPayload.locationBias.circle.radius).toBeGreaterThan(
    strictPayload.locationBias.circle.radius
  );
  expect(createSnapshot).toHaveBeenCalledWith(
    expect.objectContaining({
      usedFallback: true,
      fallbackReason: "no_matches_for_preferences",
      groupPrefs: expect.objectContaining({
        topCuisines: ["japanese"],
        preferredPrice: "$$$",
      }),
    })
  );
  expect(result.usedFallback).toBe(true);
  expect(result.fallbackReason).toBe("no_matches_for_preferences");
  expect(result.message).toBe(
    "We couldn't find strong matches for the group's preferences, so we're showing nearby alternatives instead."
  );
  expect(result.snapshot.restaurants).toHaveLength(1);
  expect(result.snapshot.restaurants[0].name).toBe("Nearby Noodles");
  expect(result.sessionStatus).toBe("selecting");
  expect(session.save).toHaveBeenCalledTimes(1);
});
