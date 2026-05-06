const { spinWheel } = require("../../controllers/wheelController");

const RecommendationSnapshot = require("../../models/RecommendationSnapshot");
const SessionSelection = require("../../models/SessionSelection");
const sessionService = require("../../services/sessionService");

jest.mock("../../models/RecommendationSnapshot");
jest.mock("../../models/SessionSelection");
jest.mock("../../services/sessionService");

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

// Test: spinWheel:
describe("wheelController.spinWheel", () => {
  // Test: Session not found:
  test("Returns 404 if session is not found", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "host1",
    };
    const res = createMockRes();

    sessionService.findSessionById.mockRejectedValue(
      createMockError("Session not found.", 404),
    );

    await spinWheel(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "Session not found.",
    });
  });

  // Test: User is not host:
  test("Returns 403 if user is not host", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user1",
    };
    const res = createMockRes();

    const mockSession = createMockSession();

    sessionService.findSessionById.mockResolvedValue(mockSession);
    sessionService.checkValidHost.mockImplementation(() => {
      throw createMockError("Only the host can spin the wheel.", 403);
    });

    await spinWheel(req, res);

    expect(sessionService.checkValidHost).toHaveBeenCalledWith(
      mockSession,
      "user1",
      "Only the host can spin the wheel.",
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "Only the host can spin the wheel.",
    });
  });

  // Test: No wheel items:
  test("Returns 400 if no wheel items are available", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "host1",
    };
    const res = createMockRes();

    const mockSession = createMockSession({
      wheelItems: [],
    });

    sessionService.findSessionById.mockResolvedValue(mockSession);
    sessionService.checkValidHost.mockImplementation(() => {});

    await spinWheel(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "No wheel items available to spin.",
    });
  });

  // Test: Wheel already spun:
  test("Returns 400 if wheel has already been spun and session is voting", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "host1",
    };
    const res = createMockRes();

    const mockSession = createMockSession({
      status: "voting",
      wheelItems: [
        { recommendationSnapshotId: "snapshot1", placeId: "place1" },
      ],
    });

    sessionService.findSessionById.mockResolvedValue(mockSession);
    sessionService.checkValidHost.mockImplementation(() => {});

    await spinWheel(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Wheel has already been spun.",
    });
  });

  // Test: Session not in spinning state:
  test("Returns 400 if session is not in spinning state", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "host1",
    };
    const res = createMockRes();

    const mockSession = createMockSession({
      status: "selecting",
      wheelItems: [
        { recommendationSnapshotId: "snapshot1", placeId: "place1" },
      ],
    });

    sessionService.findSessionById.mockResolvedValue(mockSession);
    sessionService.checkValidHost.mockImplementation(() => {});
    sessionService.checkSessionStatus.mockImplementation(() => {
      throw createMockError("Session is not in spinning state.", 400);
    });

    await spinWheel(req, res);

    expect(sessionService.checkSessionStatus).toHaveBeenCalledWith(
      mockSession,
      "spinning",
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Session is not in spinning state.",
    });
  });

  // Test: Successful spin:
  test("Successfully spins wheel and moves session to voting", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "host1",
    };
    const res = createMockRes();

    const mockSession = createMockSession({
      status: "spinning",
      wheelItems: [
        { recommendationSnapshotId: "snapshot1", placeId: "place1" },
        { recommendationSnapshotId: "snapshot1", placeId: "place2" },
        { recommendationSnapshotId: "snapshot1", placeId: "place3" },
      ],
      voteSummary: {
        acceptCount: 5,
        respinCount: 3,
        votedUserIds: ["user1"],
      },
    });

    sessionService.findSessionById.mockResolvedValue(mockSession);
    sessionService.checkValidHost.mockImplementation(() => {});
    sessionService.checkSessionStatus.mockImplementation(() => {});
    jest.spyOn(Math, "random").mockReturnValue(0);

    mockLeanFind(RecommendationSnapshot, [
      {
        _id: "snapshot1",
        restaurants: [
          {
            placeId: "place1",
            name: "Restaurant 1",
            address: "Address 1",
            location: { lat: -36.8, lng: 174.7 },
            rating: 4.5,
            priceLevel: 2,
          },
        ],
      },
    ]);

    await spinWheel(req, res);

    Math.random.mockRestore();

    // Check Database state:
    expect(mockSession.currentWheelResult).toEqual({
      recommendationSnapshotId: "snapshot1",
      placeId: "place1",
    });
    expect(mockSession.status).toBe("voting");
    expect(mockSession.voteSummary).toEqual({
      acceptCount: 0,
      respinCount: 0,
      votedUserIds: [],
    });
    expect(mockSession.save).toHaveBeenCalled();

    // Check Response:
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      session: {
        id: "session123",
        currentWheelResult: expect.objectContaining({
          placeId: "place1",
          name: "Restaurant 1",
        }),
        finalSpin: false,
        status: "voting",
      },
    });
  });

  // Test: Final spin completes session:
  test("Completes session when spin is final", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "host1",
    };
    const res = createMockRes();

    const mockSession = createMockSession({
      status: "spinning",
      wheelItems: [
        { recommendationSnapshotId: "snapshot1", placeId: "place1" },
        { recommendationSnapshotId: "snapshot1", placeId: "place2" },
      ],
    });

    sessionService.findSessionById.mockResolvedValue(mockSession);
    sessionService.checkValidHost.mockImplementation(() => {});
    sessionService.checkSessionStatus.mockImplementation(() => {});
    jest.spyOn(Math, "random").mockReturnValue(0);

    mockLeanFind(RecommendationSnapshot, [
      {
        _id: "snapshot1",
        restaurants: [
          {
            placeId: "place1",
            name: "Restaurant 1",
          },
        ],
      },
    ]);

    await spinWheel(req, res);

    Math.random.mockRestore();

    expect(mockSession.finalWheelResult).toEqual(
      mockSession.currentWheelResult,
    );
    expect(mockSession.status).toBe("completed");

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      session: {
        id: "session123",
        currentWheelResult: expect.objectContaining({
          placeId: "place1",
        }),
        finalSpin: true,
        status: "completed",
      },
    });
  });

  // Test: Fallback error handling:
  test("Returns fallback message when spinWheel fails.", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user1",
    };
    const res = createMockRes();

    sessionService.findSessionById.mockRejectedValue("Unexpected failure");

    await spinWheel(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Failed to spin the wheel.",
    });
  });
});
