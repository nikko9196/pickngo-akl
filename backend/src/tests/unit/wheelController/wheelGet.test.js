const {
  getCurrentWheel,
  getFinalWheelResult,
  getWheelState,
} = require("../../../controllers/wheelController");

const RecommendationSnapshot = require("../../../models/RecommendationSnapshot");
const SessionSelection = require("../../../models/SessionSelection");
const sessionService = require("../../../services/sessionService");

jest.mock("../../../models/RecommendationSnapshot");
jest.mock("../../../models/SessionSelection");
jest.mock("../../../services/sessionService");

function createMockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
}

function createMockError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function createMockSession(overrides = {}) {
  return {
    _id: {
      toString: () => "session123",
    },
    hostUserId: {
      toString: () => "host1",
    },
    status: "spinning",
    participants: [
      {
        userId: {
          toString: () => "host1",
        },
        roomDisplayName: "Host",
      },
      {
        userId: {
          toString: () => "user1",
        },
        roomDisplayName: "User 1",
      },
    ],
    maxSelectionsPerUser: 3,
    wheelItems: [],
    currentWheelResult: null,
    lastWheelResult: null,
    finalWheelResult: null,
    lastVoteSummary: null,
    voteSummary: {
      acceptCount: 0,
      respinCount: 0,
      votedUserIds: [],
    },
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

function mockLeanFind(model, result) {
  model.find.mockReturnValue({
    lean: jest.fn().mockResolvedValue(result),
  });
}

beforeEach(() => {
  jest.clearAllMocks();

  mockLeanFind(SessionSelection, []);
  mockLeanFind(RecommendationSnapshot, []);
});

// Test: getCurrentWheel:
describe("wheelController.getCurrentWheel", () => {
  // Test: Session not found:
  test("Returns 404 if session is not found.", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user1",
    };
    const res = createMockRes();

    sessionService.findSessionById.mockRejectedValue(
      createMockError("Session not found.", 404),
    );

    await getCurrentWheel(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  // Test: User is not a participant:
  test("Returns 403 if user is not a participant.", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user3",
    };
    const res = createMockRes();

    const mockSession = createMockSession();

    sessionService.findSessionById.mockResolvedValue(mockSession);
    sessionService.checkValidParticipant.mockImplementation(() => {
      throw createMockError("You are not a participant in this session.", 403);
    });

    await getCurrentWheel(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "You are not a participant in this session.",
    });
  });

  // Test: Returns current wheel with last result and last vote summary:
  test("Returns current wheel with last result and last vote summary.", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user1",
    };
    const res = createMockRes();

    const mockSession = createMockSession({
      status: "spinning",
      wheelItems: [
        { recommendationSnapshotId: "snapshot1", placeId: "place2" },
      ],
      lastWheelResult: {
        recommendationSnapshotId: "snapshot1",
        placeId: "place1",
      },
      lastVoteSummary: {
        acceptCount: 1,
        respinCount: 2,
        votedUserIds: ["user1", "user2"],
      },
    });

    sessionService.findSessionById.mockResolvedValue(mockSession);
    sessionService.checkValidParticipant.mockImplementation(() => {});
    mockLeanFind(RecommendationSnapshot, [
      {
        _id: "snapshot1",
        restaurants: [
          {
            placeId: "place1",
            name: "Rejected Restaurant",
            rating: 4.1,
            priceLevel: 2,
            location: { lat: -36.8, lng: 174.7 },
          },
          {
            placeId: "place2",
            name: "Remaining Restaurant",
            rating: 4.5,
            priceLevel: 1,
            location: { lat: -36.9, lng: 174.8 },
          },
        ],
      },
    ]);

    await getCurrentWheel(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      session: {
        id: "session123",
        status: "spinning",
        wheelItems: [
          expect.objectContaining({
            placeId: "place2",
            name: "Remaining Restaurant",
            rating: 4.5,
            priceLevel: 1,
            location: { lat: -36.9, lng: 174.8 },
          }),
        ],
        lastWheelResult: expect.objectContaining({
          placeId: "place1",
          name: "Rejected Restaurant",
        }),
        lastVoteSummary: {
          acceptCount: 1,
          respinCount: 2,
          votedUserIds: ["user1", "user2"],
        },
      },
    });
  });

  // Test: Returns empty wheelItems array when no wheel items exist:
  test("Returns empty wheelItems array when no wheel items exist.", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user1",
    };
    const res = createMockRes();

    const mockSession = createMockSession({
      status: "spinning",
      wheelItems: null,
    });

    sessionService.findSessionById.mockResolvedValue(mockSession);
    sessionService.checkValidParticipant.mockImplementation(() => {});

    await getCurrentWheel(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      session: {
        id: "session123",
        status: "spinning",
        wheelItems: [],
        lastWheelResult: null,
        lastVoteSummary: null,
      },
    });
  });

  // Test: Fallback error handling:
  test("Returns fallback message when getCurrentWheel fails.", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user1",
    };
    const res = createMockRes();

    sessionService.findSessionById.mockRejectedValue("Unexpected failure.");

    await getCurrentWheel(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Failed to fetch current wheel.",
    });
  });
});

// Test: getWheelState:
describe("wheelController.getWheelState", () => {
  // Test: Session not found:
  test("Returns 404 if session is not found.", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user1",
    };
    const res = createMockRes();

    sessionService.findSessionById.mockRejectedValue(
      createMockError("Session not found.", 404),
    );

    await getWheelState(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "Session not found.",
    });
  });

  // Test: User is not a participant:
  test("Returns 403 if user is not a participant.", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user2",
    };
    const res = createMockRes();

    const mockSession = createMockSession();

    sessionService.findSessionById.mockResolvedValue(mockSession);
    sessionService.checkValidParticipant.mockImplementation(() => {
      throw createMockError("You are not a participant in this session.", 403);
    });

    await getWheelState(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "You are not a participant in this session.",
    });
  });

  // Test: Returns full wheel state successfully:
  test("Returns full wheel state successfully.", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user1",
    };
    const res = createMockRes();

    const mockSession = createMockSession({
      status: "voting",
      wheelItems: [
        {
          recommendationSnapshotId: "snapshot1",
          placeId: "place1",
          userId: "user1",
          roomDisplayName: "User 1",
        },
        {
          recommendationSnapshotId: "snapshot1",
          placeId: "place2",
          userId: "host1",
          roomDisplayName: "Host",
        },
      ],
      currentWheelResult: {
        recommendationSnapshotId: "snapshot1",
        placeId: "place1",
      },
      finalWheelResult: null,
      voteSummary: {
        acceptCount: 2,
        respinCount: 1,
        votedUserIds: ["host1", "user1"],
      },
    });

    sessionService.findSessionById.mockResolvedValue(mockSession);
    sessionService.checkValidParticipant.mockImplementation(() => {});
    mockLeanFind(SessionSelection, []);
    mockLeanFind(RecommendationSnapshot, [
      {
        _id: "snapshot1",
        restaurants: [
          {
            placeId: "place1",
            name: "Restaurant 1",
            address: "Address 1",
            rating: 4.5,
            priceLevel: 2,
            location: { lat: -36.8, lng: 174.7 },
          },
          {
            placeId: "place2",
            name: "Restaurant 2",
            address: "Address 2",
            rating: 4.5,
            priceLevel: 2,
            location: { lat: -36.9, lng: 174.8 },
          },
        ],
      },
    ]);

    await getWheelState(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      session: {
        id: "session123",
        status: "voting",
        wheelItems: [
          expect.objectContaining({
            placeId: "place1",
            name: "Restaurant 1",
            userId: "user1",
            roomDisplayName: "User 1",
          }),
          expect.objectContaining({
            placeId: "place2",
            name: "Restaurant 2",
            userId: "host1",
            roomDisplayName: "Host",
          }),
        ],
        currentWheelResult: expect.objectContaining({
          placeId: "place1",
          name: "Restaurant 1",
        }),
        finalWheelResult: null,
        voteSummary: {
          acceptCount: 2,
          respinCount: 1,
          votedUserIds: ["host1", "user1"],
          votedCount: 2,
          totalParticipants: 2,
        },
      },
    });
  });

  // Test: Fallback error handling:
  test("Returns fallback message when getWheelState fails.", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user1",
    };
    const res = createMockRes();

    sessionService.findSessionById.mockRejectedValue("Unexpected failure.");

    await getWheelState(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Failed to fetch wheel state.",
    });
  });
});

// Test: getFinalWheelResult:
describe("wheelController.getFinalWheelResult", () => {
  // Test: Session not found:
  test("Returns 404 if session is not found.", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user1",
    };
    const res = createMockRes();

    sessionService.findSessionById.mockRejectedValue(
      createMockError("Session not found.", 404),
    );

    await getFinalWheelResult(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "Session not found.",
    });
  });

  // Test: User is not a participant:
  test("Returns 403 if user is not a participant.", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user3",
    };
    const res = createMockRes();

    const mockSession = createMockSession();

    sessionService.findSessionById.mockResolvedValue(mockSession);
    sessionService.checkValidParticipant.mockImplementation(() => {
      throw createMockError("You are not a participant in this session.", 403);
    });

    await getFinalWheelResult(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "You are not a participant in this session.",
    });
  });

  // Test: No final wheel result found:
  test("Returns 404 if final wheel result does not exist.", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user1",
    };
    const res = createMockRes();

    const mockSession = createMockSession({
      finalWheelResult: null,
    });

    sessionService.findSessionById.mockResolvedValue(mockSession);
    sessionService.checkValidParticipant.mockImplementation(() => {});

    await getFinalWheelResult(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "No final wheel result found.",
    });
  });

  // Test: Returns final wheel result successfully:
  test("Returns final wheel result successfully.", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user1",
    };
    const res = createMockRes();

    const mockSession = createMockSession({
      status: "completed",
      finalWheelResult: {
        recommendationSnapshotId: "snapshot1",
        placeId: "place1",
      },
      voteSummary: {
        acceptCount: 2,
        respinCount: 1,
        votedUserIds: ["host1", "user1"],
      },
      resultRatings: [
        {
          userId: { toString: () => "user1" },
          score: 4,
        },
      ],
    });

    sessionService.findSessionById.mockResolvedValue(mockSession);
    sessionService.checkValidParticipant.mockImplementation(() => {});
    mockLeanFind(RecommendationSnapshot, [
      {
        _id: "snapshot1",
        restaurants: [
          {
            placeId: "place1",
            name: "Final Restaurant",
            address: "Final Address",
            rating: 4.8,
            priceLevel: 3,
            location: { lat: -36.8, lng: 174.7 },
          },
        ],
      },
    ]);

    await getFinalWheelResult(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      session: {
        id: "session123",
        status: "completed",
        finalWheelResult: expect.objectContaining({
          placeId: "place1",
          name: "Final Restaurant",
          address: "Final Address",
          rating: 4.8,
          priceLevel: 3,
        }),
        voteSummary: {
          acceptCount: 2,
          respinCount: 1,
          votedUserIds: ["host1", "user1"],
          votedCount: 2,
          totalParticipants: 2,
        },
        resultRatingSummary: {
          ratings: [
            {
              userId: "user1",
              score: 4,
            },
          ],
          ratingCount: 1,
          averageScore: 4,
        },
      },
    });
  });

  // Test: Fallback error handling:
  test("Returns fallback message when getFinalWheelResult fails.", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user1",
    };
    const res = createMockRes();

    sessionService.findSessionById.mockRejectedValue("Unexpected failure.");

    await getFinalWheelResult(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Failed to fetch final wheel result.",
    });
  });
});
