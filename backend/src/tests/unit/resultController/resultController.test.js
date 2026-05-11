const { submitResultRating } = require("../../../controllers/resultController");
const sessionService = require("../../../services/sessionService");

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
    _id: { toString: () => "session123" },
    participants: [
      {
        userId: { toString: () => "host1" },
        roomDisplayName: "Host",
      },
      {
        userId: { toString: () => "user1" },
        roomDisplayName: "User 1",
      },
    ],
    finalWheelResult: {
      recommendationSnapshotId: "snapshot1",
      placeId: "place1",
    },
    resultRatings: [],
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// Test: submitResultRating:
describe("resultController.submitResultRating", () => {
  // Test: Rating score is invalid (Case: > 5):
  test("Returns 400 if rating score is invalid (Case: > 5).", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user1",
      body: { score: 6 },
    };
    const res = createMockRes();

    await submitResultRating(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Rating score must be an integer between 1 and 5.",
    });
  });

  // Test: Rating score is invalid (Case: < 1):
  test("Returns 400 if rating score is invalid (Case: < 1).", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user1",
      body: { score: -6 },
    };
    const res = createMockRes();

    await submitResultRating(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Rating score must be an integer between 1 and 5.",
    });
  });

  // Test: Rating score is invalid (Case: Invalid string type):
  test("Returns 400 if rating score is invalid (Case: Invalid string type).", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user1",
      body: { score: "rating" },
    };
    const res = createMockRes();

    await submitResultRating(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Rating score must be an integer between 1 and 5.",
    });
  });

  // Test: Rating score is invalid (Case: Null):
  test("Returns 400 if rating score is invalid (Case: Null).", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user1",
      body: { score: null },
    };
    const res = createMockRes();

    await submitResultRating(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Rating score must be an integer between 1 and 5.",
    });
  });

  // Test: Session not found:
  test("Returns 404 if session is not found.", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user1",
      body: { score: 4 },
    };
    const res = createMockRes();

    sessionService.findSessionById.mockRejectedValue(
      createMockError("Session not found.", 404),
    );

    await submitResultRating(req, res);

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
      body: { score: 4 },
    };
    const res = createMockRes();

    const mockSession = createMockSession();

    sessionService.findSessionById.mockResolvedValue(mockSession);
    sessionService.checkValidParticipant.mockImplementation(() => {
      throw createMockError("You are not a participant in this session.", 403);
    });

    await submitResultRating(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "You are not a participant in this session.",
    });
  });

  // Test: No final result is available to rate:
  test("Returns 400 if no final result is available to rate.", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user1",
      body: { score: 4 },
    };
    const res = createMockRes();

    const mockSession = createMockSession({
      finalWheelResult: null,
    });

    sessionService.findSessionById.mockResolvedValue(mockSession);
    sessionService.checkValidParticipant.mockImplementation(() => {});

    await submitResultRating(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "No final result is available to rate.",
    });
  });

  // Test: Add a new rating successfully:
  test("Add a new rating successfully.", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user1",
      body: { score: 4 },
    };
    const res = createMockRes();

    const mockSession = createMockSession();

    sessionService.findSessionById.mockResolvedValue(mockSession);
    sessionService.checkValidParticipant.mockImplementation(() => {});

    await submitResultRating(req, res);

    expect(mockSession.resultRatings).toEqual([
      {
        userId: "user1",
        score: 4,
      },
    ]);
    expect(mockSession.save).toHaveBeenCalled();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Rating saved.",
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
    });
  });

  // Test: Update an existing rating successfully:
  test("Update an existing rating successfully.", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user1",
      body: { score: 5 },
    };
    const res = createMockRes();

    const mockSession = createMockSession({
      resultRatings: [
        {
          userId: { toString: () => "user1" },
          score: 3,
        },
      ],
    });

    sessionService.findSessionById.mockResolvedValue(mockSession);
    sessionService.checkValidParticipant.mockImplementation(() => {});

    await submitResultRating(req, res);

    expect(mockSession.resultRatings[0].score).toBe(5);
    expect(mockSession.save).toHaveBeenCalled();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Rating saved.",
      resultRatingSummary: {
        ratings: [
          {
            userId: "user1",
            score: 5,
          },
        ],
        ratingCount: 1,
        averageScore: 5,
      },
    });
  });

  // Test: Calculates average rating correctly when multiple users have rated:
  test("Calculates average rating correctly when multiple users have rated.", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user2",
      body: { score: 5 },
    };
    const res = createMockRes();

    const mockSession = createMockSession({
      resultRatings: [
        {
          userId: { toString: () => "user1" },
          score: 2,
        },
      ],
    });

    sessionService.findSessionById.mockResolvedValue(mockSession);
    sessionService.checkValidParticipant.mockImplementation(() => {});

    await submitResultRating(req, res);

    expect(mockSession.resultRatings).toHaveLength(2);
    expect(mockSession.resultRatings[1]).toEqual({
      userId: "user2",
      score: 5,
    });
    expect(mockSession.save).toHaveBeenCalled();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Rating saved.",
      resultRatingSummary: {
        ratings: [
          {
            userId: "user1",
            score: 2,
          },
          {
            userId: "user2",
            score: 5,
          },
        ],
        ratingCount: 2,
        averageScore: 3.5,
      },
    });
  });

  // Test: Fallback error handling:
  test("Returns fallback message when submitResultRating fails.", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user1",
      body: { score: 4 },
    };
    const res = createMockRes();

    sessionService.findSessionById.mockRejectedValue("Unexpected failure.");

    await submitResultRating(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Failed to save rating.",
    });
  });
});
