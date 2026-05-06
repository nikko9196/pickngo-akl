const {
  sendReminder,
  getReminder,
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

// Test: sendReminder:
describe("readyController.sendReminder", () => {
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

    await sendReminder(req, res);

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
      throw createMockError("Only the host can send reminders.", 403);
    });

    await sendReminder(req, res);

    expect(sessionService.checkValidHost).toHaveBeenCalledWith(
      mockSession,
      "user1",
      "Only the host can send reminders.",
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "Only the host can send reminders.",
    });
  });

  // Test: Returns waiting participant user IDs:
  test("Returns waiting participant user IDs", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "host1",
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
    sessionService.checkValidHost.mockImplementation(() => {});

    await sendReminder(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Reminder sent to waiting users.",
      remindedUserIds: ["user1"],
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
  test("Returns fallback message when sendReminder fails", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "host1",
    };
    const res = createMockRes();

    sessionService.findSessionById.mockRejectedValue("Unexpected failure");

    await sendReminder(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Failed to send reminder.",
    });
  });
});

// Test: getReminder:
describe("readyController.getReminder", () => {
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

    await getReminder(req, res);

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

    await getReminder(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "You are not a participant in this session.",
    });
  });

  // Test: Returns waiting participant user IDs:
  test("Returns waiting participant user IDs", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "host1",
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

    await getReminder(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      message: "Reminder status retrieved.",
      remindedUserIds: ["user1"],
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
  test("Returns fallback message when getReminder fails", async () => {
    const req = {
      params: { sessionId: "session123" },
      userId: "user1",
    };
    const res = createMockRes();

    sessionService.findSessionById.mockRejectedValue("Unexpected failure");

    await getReminder(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Failed to get reminder.",
    });
  });
});
