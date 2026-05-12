const {
  submitVote,
  resolveVote,
  getVoteSummary,
} = require("../../../controllers/voteController");

const sessionService = require("../../../services/sessionService");
const voteService = require("../../../services/voteService");

jest.mock("../../../services/sessionService");
jest.mock("../../../services/voteService");

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
    _id: "session123",
    status: "voting",
    participants: [{ userId: "user1" }, { userId: "user2" }],
    voteSummary: {
      acceptCount: 0,
      respinCount: 0,
      votedUserIds: [],
    },
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// Test: submitVote:
describe("voteController.submitVote", () => {
  // Test: Invalid vote:
  test("Returns 400 for invalid vote.", async () => {
    const req = {
      params: { sessionId: "session123" },
      body: { vote: "invalid" },
      userId: "user1",
    };
    const res = createMockRes();

    await submitVote(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Vote must be 'accept' or 'respin'.",
    });
  });

  // Test: Session not found:
  test("Returns 404 if session is not found.", async () => {
    const req = {
      params: { sessionId: "session123" },
      body: { vote: "accept" },
      userId: "user1",
    };
    const res = createMockRes();

    sessionService.findSessionById.mockRejectedValue(
      createMockError("Session not found.", 404),
    );

    await submitVote(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "Session not found.",
    });
  });

  // Test: User is not a participant:
  test("Returns 403 if user is not a participant.", async () => {
    const req = {
      params: { sessionId: "session123" },
      body: { vote: "accept" },
      userId: "user3",
    };
    const res = createMockRes();

    const mockSession = createMockSession();

    sessionService.findSessionById.mockResolvedValue(mockSession);
    sessionService.checkValidParticipant.mockImplementation(() => {
      throw createMockError("You are not a participant in this session.", 403);
    });

    await submitVote(req, res);

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

  // Test: Session not in voting state:
  test("Returns 400 if session is not in voting state.", async () => {
    const req = {
      params: { sessionId: "session123" },
      body: { vote: "accept" },
      userId: "user1",
    };
    const res = createMockRes();

    const mockSession = createMockSession({
      status: "spinning",
    });

    sessionService.findSessionById.mockResolvedValue(mockSession);
    sessionService.checkValidParticipant.mockImplementation(() => {});
    sessionService.checkSessionStatus.mockImplementation(() => {
      throw createMockError("Session is not in voting state.", 400);
    });

    await submitVote(req, res);

    expect(sessionService.findSessionById).toHaveBeenCalledWith("session123");
    expect(sessionService.checkValidParticipant).toHaveBeenCalledWith(
      mockSession,
      "user1",
    );
    expect(sessionService.checkSessionStatus).toHaveBeenCalledWith(
      mockSession,
      "voting",
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Session is not in voting state.",
    });
  });

  // Test: Successfully submit accept vote:
  test("Successfully submits accept vote and returns voteSummary.", async () => {
    const req = {
      params: { sessionId: "session123" },
      body: { vote: "accept" },
      userId: "user1",
    };
    const res = createMockRes();

    const mockSession = createMockSession();
    const mockVoteSummary = {
      acceptCount: 1,
      respinCount: 0,
      votedUserIds: ["user1"],
    };

    sessionService.findSessionById.mockResolvedValue(mockSession);
    sessionService.checkValidParticipant.mockImplementation(() => {});
    sessionService.checkSessionStatus.mockImplementation(() => {});
    voteService.applyVote.mockResolvedValue(mockVoteSummary);

    await submitVote(req, res);

    expect(sessionService.findSessionById).toHaveBeenCalledWith("session123");
    expect(sessionService.checkValidParticipant).toHaveBeenCalledWith(
      mockSession,
      "user1",
    );
    expect(sessionService.checkSessionStatus).toHaveBeenCalledWith(
      mockSession,
      "voting",
    );
    expect(voteService.applyVote).toHaveBeenCalledWith(
      mockSession,
      "user1",
      "accept",
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      voteSummary: mockVoteSummary,
    });
  });

  // Test: Successfully submit respin vote:
  test("Successfully submits respin vote and returns voteSummary.", async () => {
    const req = {
      params: { sessionId: "session123" },
      body: { vote: "respin" },
      userId: "user2",
    };
    const res = createMockRes();

    const mockSession = createMockSession();
    const mockVoteSummary = {
      acceptCount: 0,
      respinCount: 1,
      votedUserIds: ["user2"],
    };

    sessionService.findSessionById.mockResolvedValue(mockSession);
    sessionService.checkValidParticipant.mockImplementation(() => {});
    sessionService.checkSessionStatus.mockImplementation(() => {});
    voteService.applyVote.mockResolvedValue(mockVoteSummary);

    await submitVote(req, res);

    expect(sessionService.findSessionById).toHaveBeenCalledWith("session123");
    expect(sessionService.checkValidParticipant).toHaveBeenCalledWith(
      mockSession,
      "user2",
    );
    expect(sessionService.checkSessionStatus).toHaveBeenCalledWith(
      mockSession,
      "voting",
    );
    expect(voteService.applyVote).toHaveBeenCalledWith(
      mockSession,
      "user2",
      "respin",
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      voteSummary: mockVoteSummary,
    });
  });

  // Test: Fallback error handling:
  test("Returns fallback message when submitVote fails.", async () => {
    const req = {
      params: { sessionId: "session123" },
      body: { vote: "accept" },
      userId: "user1",
    };
    const res = createMockRes();

    const mockSession = createMockSession();

    sessionService.findSessionById.mockResolvedValue(mockSession);
    sessionService.checkValidParticipant.mockImplementation(() => {});
    sessionService.checkSessionStatus.mockImplementation(() => {});
    voteService.applyVote.mockRejectedValue("Unexpected failure.");

    await submitVote(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Failed to submit vote.",
    });
  });
});

// Test: resolveVote:
describe("voteController.resolveVote", () => {
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

    await resolveVote(req, res);

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

    await resolveVote(req, res);

    expect(sessionService.checkValidParticipant).toHaveBeenCalledWith(
      mockSession,
      "user3",
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "You are not a participant in this session.",
    });
  });

  // Test: Returns 400 if session is not in voting state:
  test("Returns 400 if session is not in voting state.", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user1",
    };
    const res = createMockRes();

    const mockSession = createMockSession({
      status: "spinning",
    });

    sessionService.findSessionById.mockResolvedValue(mockSession);
    sessionService.checkValidParticipant.mockImplementation(() => {});
    sessionService.checkSessionStatus.mockImplementation(() => {
      throw createMockError("Session is not in voting state.", 400);
    });

    await resolveVote(req, res);

    expect(sessionService.checkSessionStatus).toHaveBeenCalledWith(
      mockSession,
      "voting",
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Session is not in voting state.",
    });
  });

  // Test: Successfully resolve vote:
  test("Successfully resolves vote and returns result.", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user1",
    };
    const res = createMockRes();

    const mockSession = createMockSession();
    const mockResult = {
      result: "The wheel result is accepted.",
      status: "completed",
      finalWheelResult: {
        recommendationSnapshotId: "snapshot1",
        placeId: "place1",
      },
      voteSummary: {
        acceptCount: 2,
        respinCount: 1,
        votedUserIds: ["user1", "user2", "user3"],
      },
    };

    sessionService.findSessionById.mockResolvedValue(mockSession);
    sessionService.checkValidParticipant.mockImplementation(() => {});
    sessionService.checkSessionStatus.mockImplementation(() => {});
    voteService.calculateVoteResult.mockResolvedValue(mockResult);

    await resolveVote(req, res);

    expect(sessionService.findSessionById).toHaveBeenCalledWith("session123");
    expect(sessionService.checkValidParticipant).toHaveBeenCalledWith(
      mockSession,
      "user1",
    );
    expect(sessionService.checkSessionStatus).toHaveBeenCalledWith(
      mockSession,
      "voting",
    );
    expect(voteService.calculateVoteResult).toHaveBeenCalledWith(mockSession);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(mockResult);
  });

  // Test: Fallback error handling:
  test("Returns fallback message when resolveVote fails.", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user1",
    };
    const res = createMockRes();

    const mockSession = createMockSession();

    sessionService.findSessionById.mockResolvedValue(mockSession);
    sessionService.checkValidParticipant.mockImplementation(() => {});
    sessionService.checkSessionStatus.mockImplementation(() => {});
    voteService.calculateVoteResult.mockRejectedValue("Unexpected failure.");

    await resolveVote(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Failed to resolve vote.",
    });
  });
});

// Test: getVoteSummary:
describe("voteController.getVoteSummary", () => {
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

    await getVoteSummary(req, res);

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

    await getVoteSummary(req, res);

    expect(sessionService.checkValidParticipant).toHaveBeenCalledWith(
      mockSession,
      "user3",
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "You are not a participant in this session.",
    });
  });

  // Test: Returns vote summary successfully:
  test("Returns vote summary successfully.", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user1",
    };
    const res = createMockRes();

    const mockSession = createMockSession({
      voteSummary: {
        acceptCount: 2,
        respinCount: 1,
        votedUserIds: ["user1", "user2", "user3"],
      },
      participants: [
        { userId: "user1" },
        { userId: "user2" },
        { userId: "user3" },
      ],
    });

    sessionService.findSessionById.mockResolvedValue(mockSession);
    sessionService.checkValidParticipant.mockImplementation(() => {});

    await getVoteSummary(req, res);

    expect(sessionService.findSessionById).toHaveBeenCalledWith("session123");
    expect(sessionService.checkValidParticipant).toHaveBeenCalledWith(
      mockSession,
      "user1",
    );

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      voteSummary: {
        acceptCount: 2,
        respinCount: 1,
        votedUserIds: ["user1", "user2", "user3"],
        votedCount: 3,
        totalParticipants: 3,
      },
    });
  });

  // Test: Fallback error handling:
  test("Returns fallback message when getVoteSummary fails.", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user1",
    };
    const res = createMockRes();

    sessionService.findSessionById.mockRejectedValue("Unexpected failure.");

    await getVoteSummary(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Failed to fetch vote summary.",
    });
  });
});
