const { buildWheel } = require("../../controllers/wheelController");

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

// Test: buildWheel:
describe("wheelController.buildWheel", () => {
  // Test: Session not found:
  test("Returns 404 if session is not found", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user1",
    };
    const res = createMockRes();

    sessionService.findSessionById.mockRejectedValue(
      createMockError("Session not found.", 404),
    );

    await buildWheel(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "Session not found.",
    });
  });

  // Test: User is not a participant:
  test("Returns 403 if user is not participant", async () => {
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

    await buildWheel(req, res);

    expect(sessionService.findSessionById).toHaveBeenCalledWith("session123");
    expect(sessionService.checkValidParticipant).toHaveBeenCalledWith(
      mockSession,
      "user3",
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "You are not a participant in this session.",
    });
  });

  // Test: No saved selections:
  test("Returns 404 if there are no saved selections", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user1",
    };
    const res = createMockRes();

    const mockSession = createMockSession();

    sessionService.findSessionById.mockResolvedValue(mockSession);
    sessionService.checkValidParticipant.mockImplementation(() => {});
    mockLeanFind(SessionSelection, []);

    await buildWheel(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message:
        "No saved restaurant selections found for this session to build the wheel.",
    });
  });

  // Test: Wheel items exceed maximum allowed selections:
  test("Returns 400 if wheel items exceed maximum allowed selections", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user1",
    };
    const res = createMockRes();

    const mockSession = createMockSession({
      status: "selecting",
      maxSelectionsPerUser: 1,
    });

    const sessionSelections = [
      {
        userId: "user1",
        recommendationSnapshotId: "snapshot1",
        selections: [{ placeId: "place1" }, { placeId: "place2" }],
      },
      {
        userId: "host1",
        recommendationSnapshotId: "snapshot1",
        selections: [{ placeId: "place3" }],
      },
    ];

    sessionService.findSessionById.mockResolvedValue(mockSession);
    sessionService.checkValidParticipant.mockImplementation(() => {});
    mockLeanFind(SessionSelection, sessionSelections);

    await buildWheel(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message:
        "Wheel items exceed the maximum allowed selections for this session.",
    });
  });

  // Test: Returns current wheel without rebuilding when session is voting:
  test("Returns current wheel without rebuilding when session is voting", async () => {
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
      ],
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
            location: { lat: -36.8, lng: 174.7 },
            rating: 4.5,
            priceLevel: 2,
          },
        ],
      },
    ]);

    await buildWheel(req, res);

    expect(mockSession.save).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      session: {
        id: "session123",
        status: "voting",
        wheelItems: [
          expect.objectContaining({
            placeId: "place1",
            name: "Restaurant 1",
          }),
        ],
      },
    });
  });

  // Test: Returns current wheel without rebuilding when session is completed:
  test("Returns current wheel without rebuilding when session is completed", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user1",
    };
    const res = createMockRes();

    const mockSession = createMockSession({
      status: "completed",
      wheelItems: [
        {
          recommendationSnapshotId: "snapshot1",
          placeId: "place1",
          userId: "user1",
          roomDisplayName: "User 1",
        },
      ],
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
          },
        ],
      },
    ]);

    await buildWheel(req, res);

    expect(mockSession.save).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      session: {
        id: "session123",
        status: "completed",
        wheelItems: [
          expect.objectContaining({
            placeId: "place1",
            name: "Restaurant 1",
          }),
        ],
      },
    });
  });

  // Test: Successfully builds wheel and resets state:
  test("Successfully builds wheel from saved selections and resets wheel state", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user1",
    };
    const res = createMockRes();

    const mockSession = createMockSession({
      status: "selecting",
      currentWheelResult: { placeId: "oldPlace" },
      lastWheelResult: { placeId: "lastPlace" },
      finalWheelResult: { placeId: "finalPlace" },
      lastVoteSummary: {
        acceptCount: 1,
        respinCount: 2,
        votedUserIds: ["user1"],
      },
      voteSummary: {
        acceptCount: 5,
        respinCount: 4,
        votedUserIds: ["user1", "user2"],
      },
    });

    const sessionSelections = [
      {
        userId: "user1",
        recommendationSnapshotId: "snapshot1",
        selections: [
          {
            placeId: "place1",
            name: "Restaurant 1",
            address: "Address 1",
            location: { lat: -36.8, lng: 174.7 },
            rating: 4.5,
            priceLevel: 2,
          },
          {
            placeId: "place2",
            name: "Restaurant 2",
            address: "Address 2",
            location: { lat: -36.9, lng: 174.8 },
            rating: 4.2,
            priceLevel: 1,
          },
        ],
      },
    ];

    sessionService.findSessionById.mockResolvedValue(mockSession);
    sessionService.checkValidParticipant.mockImplementation(() => {});
    mockLeanFind(SessionSelection, sessionSelections);

    await buildWheel(req, res);

    // Check Database state:
    expect(mockSession.wheelItems).toEqual([
      {
        recommendationSnapshotId: "snapshot1",
        placeId: "place1",
        userId: "user1",
        roomDisplayName: "User 1",
      },
      {
        recommendationSnapshotId: "snapshot1",
        placeId: "place2",
        userId: "user1",
        roomDisplayName: "User 1",
      },
    ]);
    expect(mockSession.currentWheelResult).toBeNull();
    expect(mockSession.lastWheelResult).toBeNull();
    expect(mockSession.finalWheelResult).toBeNull();
    expect(mockSession.voteSummary).toEqual({
      acceptCount: 0,
      respinCount: 0,
      votedUserIds: [],
    });
    expect(mockSession.lastVoteSummary).toBeNull();
    expect(mockSession.save).toHaveBeenCalled();

    // Check Response:
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      session: {
        id: "session123",
        wheelItems: expect.arrayContaining([
          expect.objectContaining({
            placeId: "place1",
            name: "Restaurant 1",
            userId: "user1",
            roomDisplayName: "User 1",
          }),
          expect.objectContaining({
            placeId: "place2",
            name: "Restaurant 2",
            userId: "user1",
            roomDisplayName: "User 1",
          }),
        ]),
      },
    });
  });

  // Test: Fallback error handling:
  test("Returns fallback message when buildWheel fails.", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user1",
    };
    const res = createMockRes();

    sessionService.findSessionById.mockRejectedValue("Unexpected failure");

    await buildWheel(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Failed to build the wheel.",
    });
  });
});
