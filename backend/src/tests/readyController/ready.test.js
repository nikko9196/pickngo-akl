const {
  markReady,
  markAllReady,
  getReadyStatus,
} = require("../../controllers/readyController");

const sessionService = require("../../services/sessionService");

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
    status: "selecting",
    participants: [
      {
        userId: { toString: () => "host1" },
        role: "host",
        roomDisplayName: "Host",
        isReady: false,
      },
      {
        userId: { toString: () => "user1" },
        role: "member",
        roomDisplayName: "User 1",
        isReady: false,
      },
    ],
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

// Test: markReady:
describe("readyController.markReady", () => {
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

    await markReady(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "Session not found.",
    });
  });

  // Test: User is not a participant:
  test("Returns 403 if user is not participant", async () => {
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

    await markReady(req, res);

    expect(sessionService.checkValidParticipant).toHaveBeenCalledWith(
      mockSession,
      "user2",
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "You are not a participant in this session.",
    });
  });

  // Test: User clicks READY successfully:
  test("Marks current user as ready", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user1",
    };
    const res = createMockRes();

    const mockSession = createMockSession();

    sessionService.findSessionById.mockResolvedValue(mockSession);
    sessionService.checkValidParticipant.mockImplementation(() => {});

    await markReady(req, res);

    expect(mockSession.participants[1].isReady).toBe(true);
    expect(mockSession.status).toBe("selecting");
    expect(mockSession.save).toHaveBeenCalled();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "User is ready.",
      readySummary: {
        sessionId: "session123",
        readyCount: 1,
        totalParticipants: 2,
        allReady: false,
        participants: [
          {
            userId: "host1",
            role: "host",
            roomDisplayName: "Host",
            isReady: false,
          },
          {
            userId: "user1",
            role: "member",
            roomDisplayName: "User 1",
            isReady: true,
          },
        ],
      },
    });
  });

  // Test: Changes session status to spinning when all users are ready:
  test("Changes session status to spinning when all users are ready", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user1",
    };
    const res = createMockRes();

    const mockSession = createMockSession({
      participants: [
        {
          userId: { toString: () => "host1" },
          role: "host",
          roomDisplayName: "Host",
          isReady: true,
        },
        {
          userId: { toString: () => "user1" },
          role: "member",
          roomDisplayName: "User 1",
          isReady: false,
        },
      ],
    });

    sessionService.findSessionById.mockResolvedValue(mockSession);
    sessionService.checkValidParticipant.mockImplementation(() => {});

    await markReady(req, res);

    expect(mockSession.participants[1].isReady).toBe(true);
    expect(mockSession.status).toBe("spinning");
    expect(mockSession.save).toHaveBeenCalled();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "User is ready.",
        readySummary: expect.objectContaining({
          readyCount: 2,
          totalParticipants: 2,
          allReady: true,
        }),
      }),
    );
  });

  // Test: Fallback error handling:
  test("Returns fallback message when markReady fails", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user1",
    };
    const res = createMockRes();

    sessionService.findSessionById.mockRejectedValue("Unexpected failure");

    await markReady(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Failed to mark user as ready.",
    });
  });
});

// Test: markAllReady:
describe("readyController.markAllReady", () => {
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

    await markAllReady(req, res);

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
      throw createMockError("Only the host can mark all users as ready.", 403);
    });

    await markAllReady(req, res);

    expect(sessionService.checkValidHost).toHaveBeenCalledWith(
      mockSession,
      "user1",
      "Only the host can mark all users as ready.",
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "Only the host can mark all users as ready.",
    });
  });

  // Test: Marks all users as ready and changes status to spinning:
  test("Marks all users as ready and changes status to spinning", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "host1",
    };
    const res = createMockRes();

    const mockSession = createMockSession();

    sessionService.findSessionById.mockResolvedValue(mockSession);
    sessionService.checkValidHost.mockImplementation(() => {});

    await markAllReady(req, res);

    expect(
      mockSession.participants.every((participant) => participant.isReady),
    ).toBe(true);
    expect(mockSession.status).toBe("spinning");
    expect(mockSession.save).toHaveBeenCalled();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "All users are ready.",
        readySummary: expect.objectContaining({
          readyCount: 2,
          totalParticipants: 2,
          allReady: true,
        }),
      }),
    );
  });

  // Test: Fallback error handling:
  test("Returns fallback message when markAllReady fails", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "host1",
    };
    const res = createMockRes();

    sessionService.findSessionById.mockRejectedValue("Unexpected failure");

    await markAllReady(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Failed to mark all users as ready.",
    });
  });
});

// Test: getReadyStatus:
describe("readyController.getReadyStatus", () => {
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

    await getReadyStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "Session not found.",
    });
  });

  // Test: User is not a participant:
  test("Returns 403 if user is not participant", async () => {
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

    await getReadyStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "You are not a participant in this session.",
    });
  });

  // Test: Returns ready summary successfully:
  test("Returns ready summary successfully", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user1",
    };
    const res = createMockRes();

    const mockSession = createMockSession({
      participants: [
        {
          userId: { toString: () => "host1" },
          role: "host",
          roomDisplayName: "Host",
          isReady: true,
        },
        {
          userId: { toString: () => "user1" },
          role: "member",
          roomDisplayName: "User 1",
          isReady: false,
        },
      ],
    });

    sessionService.findSessionById.mockResolvedValue(mockSession);
    sessionService.checkValidParticipant.mockImplementation(() => {});

    await getReadyStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      readySummary: {
        sessionId: "session123",
        readyCount: 1,
        totalParticipants: 2,
        allReady: false,
        participants: [
          {
            userId: "host1",
            role: "host",
            roomDisplayName: "Host",
            isReady: true,
          },
          {
            userId: "user1",
            role: "member",
            roomDisplayName: "User 1",
            isReady: false,
          },
        ],
      },
    });
  });

  // Test: Fallback error handling:
  test("Returns fallback message when getReadyStatus fails", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user1",
    };
    const res = createMockRes();

    sessionService.findSessionById.mockRejectedValue("Unexpected failure");

    await getReadyStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Failed to fetch ready status.",
    });
  });
});
