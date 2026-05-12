const {
  checkIsHost,
  getMySessions,
  getSessionByCode,
  getSessionProgress,
  updateSession,
  updateSessionStatus,
} = require("../../../controllers/sessionController");
const Session = require("../../../models/Session");
const Response = require("../../../models/Response");
const QuestionList = require("../../../models/QuestionList");
const sessionService = require("../../../services/sessionService");

jest.mock("../../../models/Session");
jest.mock("../../../models/Response");
jest.mock("../../../models/QuestionList");
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

function createSessionObject(overrides = {}) {
  return {
    _id: {
      toString: () => "session123",
    },
    hostUserId: {
      toString: () => "host1",
    },
    sessionCode: "ABC123",
    joinUrl: "http://localhost:5173/join/ABC123",
    status: "questioning",
    maxParticipants: 4,
    maxSelectionsPerUser: 3,
    location: {
      source: "map",
      label: "Auckland CBD",
      lat: -36.8485,
      lng: 174.7633,
      radiusMeters: 3000,
    },
    participants: [
      {
        userId: {
          toString: () => "host1",
        },
        role: "host",
        roomDisplayName: "Host",
        isReady: false,
        joinedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        userId: {
          toString: () => "user1",
        },
        role: "member",
        roomDisplayName: "User 1",
        isReady: true,
        joinedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function createMockSession(overrides = {}) {
  const sessionObject = createSessionObject(overrides);
  const session = {
    ...sessionObject,
    save: jest.fn().mockResolvedValue(true),
  };

  session.toObject = jest.fn(() => ({
    ...sessionObject,
    status: session.status,
    maxParticipants: session.maxParticipants,
    maxSelectionsPerUser: session.maxSelectionsPerUser,
  }));

  return session;
}

function mockFindOne(session) {
  Session.findOne.mockReturnValue({
    populate: jest.fn().mockResolvedValue(session),
  });
}

function mockFindById(session) {
  Session.findById.mockReturnValue({
    populate: jest.fn().mockResolvedValue(session),
  });
}

function mockFind(sessions) {
  const populate = jest.fn().mockResolvedValue(sessions);
  const sort = jest.fn(() => ({ populate }));
  Session.find.mockReturnValue({ sort });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("sessionController.getMySessions", () => {
  test("Returns current user's sessions", async () => {
    const req = { userId: "user1" };
    const res = createMockRes();
    const session = createMockSession();

    mockFind([session]);

    await getMySessions(req, res);

    expect(Session.find).toHaveBeenCalledWith({
      "participants.userId": "user1",
    });
    expect(res.json).toHaveBeenCalledWith({
      sessions: [
        expect.objectContaining({
          id: "session123",
          currentUserRole: "member",
          currentUserRoomDisplayName: "User 1",
          currentUserReady: true,
        }),
      ],
    });
  });

  test("Returns an empty array when current user has no sessions", async () => {
    const req = { userId: "user1" };
    const res = createMockRes();

    mockFind([]);

    await getMySessions(req, res);

    expect(res.json).toHaveBeenCalledWith({
      sessions: [],
    });
  });

  test("Returns 500 if fetching user's sessions fails", async () => {
    const req = { userId: "user1" };
    const res = createMockRes();

    Session.find.mockImplementation(() => {
      throw new Error("Failed to query sessions.");
    });

    await getMySessions(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Failed to query sessions.",
    });
  });
});

describe("sessionController.getSessionByCode", () => {
  test("Returns 400 if session code is missing", async () => {
    const req = {
      userId: "user1",
      params: {},
    };
    const res = createMockRes();

    await getSessionByCode(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Session code is required.",
    });
  });

  test("Returns session details by code for a participant", async () => {
    const req = {
      userId: "user1",
      params: { sessionCode: " abc123 " },
    };
    const res = createMockRes();
    const session = createMockSession();

    mockFindOne(session);

    await getSessionByCode(req, res);

    expect(Session.findOne).toHaveBeenCalledWith({
      sessionCode: "ABC123",
      "participants.userId": "user1",
    });
    expect(res.json).toHaveBeenCalledWith({
      session: expect.objectContaining({
        id: "session123",
        sessionCode: "ABC123",
        currentUserRole: "member",
        currentUserReady: true,
        participants: expect.arrayContaining([
          expect.objectContaining({
            userId: "user1",
            isReady: true,
          }),
        ]),
      }),
    });
  });

  test("Returns 404 if room is not found or user is not a participant", async () => {
    const req = {
      userId: "user2",
      params: { sessionCode: "ABC123" },
    };
    const res = createMockRes();

    mockFindOne(null);

    await getSessionByCode(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "Room not found or you are not a participant.",
    });
  });

  test("Returns 500 if fetching room by code fails", async () => {
    const req = {
      userId: "user1",
      params: { sessionCode: "ABC123" },
    };
    const res = createMockRes();

    Session.findOne.mockImplementation(() => {
      throw new Error("Room lookup failed.");
    });

    await getSessionByCode(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Room lookup failed.",
    });
  });
});

describe("sessionController.getSessionProgress", () => {
  test("Returns progress for all participants on session page", async () => {
    const req = {
      userId: "user1",
      params: { sessionId: "session123" },
    };
    const res = createMockRes();
    const session = createMockSession();

    mockFindById(session);
    QuestionList.countDocuments.mockResolvedValue(2);
    Response.aggregate.mockResolvedValue([
      { _id: "host1", answeredCount: 2 },
      { _id: "user1", answeredCount: 1 },
    ]);

    await getSessionProgress(req, res);

    expect(QuestionList.countDocuments).toHaveBeenCalledWith({
      isActive: true,
      "questionList.0": { $exists: true },
    });
    expect(Response.aggregate).toHaveBeenCalledWith([
      { $match: { sessionId: "session123" } },
      { $group: { _id: "$userId", answeredCount: { $sum: 1 } } },
    ]);
    expect(res.json).toHaveBeenCalledWith({
      progress: {
        sessionId: "session123",
        totalParticipants: 2,
        totalQuestions: 2,
        completedCount: 1,
        pendingCount: 1,
        allComplete: false,
        participants: [
          {
            userId: "host1",
            roomDisplayName: "Host",
            answeredCount: 2,
            isComplete: true,
          },
          {
            userId: "user1",
            roomDisplayName: "User 1",
            answeredCount: 1,
            isComplete: false,
          },
        ],
      },
    });
  });

  test("Returns 403 if user is not a participant", async () => {
    const req = {
      userId: "user2",
      params: { sessionId: "session123" },
    };
    const res = createMockRes();
    const session = createMockSession();

    mockFindById(session);

    await getSessionProgress(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "You are not a participant in this room.",
    });
  });

  test("Returns 404 if session does not exist", async () => {
    const req = {
      userId: "user1",
      params: { sessionId: "missing-session" },
    };
    const res = createMockRes();

    mockFindById(null);

    await getSessionProgress(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "Room not found.",
    });
  });

  test("Returns allComplete true when every participant answered all questions", async () => {
    const req = {
      userId: "user1",
      params: { sessionId: "session123" },
    };
    const res = createMockRes();
    const session = createMockSession();

    mockFindById(session);
    QuestionList.countDocuments.mockResolvedValue(2);
    Response.aggregate.mockResolvedValue([
      { _id: "host1", answeredCount: 2 },
      { _id: "user1", answeredCount: 2 },
    ]);

    await getSessionProgress(req, res);

    expect(res.json).toHaveBeenCalledWith({
      progress: expect.objectContaining({
        completedCount: 2,
        pendingCount: 0,
        allComplete: true,
        participants: [
          expect.objectContaining({
            userId: "host1",
            isComplete: true,
          }),
          expect.objectContaining({
            userId: "user1",
            isComplete: true,
          }),
        ],
      }),
    });
  });

  test("Returns 500 if progress aggregation fails", async () => {
    const req = {
      userId: "user1",
      params: { sessionId: "session123" },
    };
    const res = createMockRes();
    const session = createMockSession();

    mockFindById(session);
    QuestionList.countDocuments.mockResolvedValue(2);
    Response.aggregate.mockRejectedValue(new Error("Progress aggregation failed."));

    await getSessionProgress(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Progress aggregation failed.",
    });
  });
});

describe("sessionController.updateSession", () => {
  test("Allows host to update room settings while waiting", async () => {
    const req = {
      userId: "host1",
      params: { sessionId: "session123" },
      body: {
        maxParticipants: 5,
        maxSelectionsPerUser: 4,
      },
    };
    const res = createMockRes();
    const session = createMockSession({ status: "waiting" });

    mockFindById(session);

    await updateSession(req, res);

    expect(session.maxParticipants).toBe(5);
    expect(session.maxSelectionsPerUser).toBe(4);
    expect(session.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      session: expect.objectContaining({
        maxParticipants: 5,
        maxSelectionsPerUser: 4,
      }),
    });
  });

  test("Prevents changing max participants after the room starts", async () => {
    const req = {
      userId: "host1",
      params: { sessionId: "session123" },
      body: {
        maxParticipants: 5,
        maxSelectionsPerUser: 3,
      },
    };
    const res = createMockRes();
    const session = createMockSession({
      status: "questioning",
      maxParticipants: 4,
      maxSelectionsPerUser: 3,
    });

    mockFindById(session);

    await updateSession(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: "Max participants can only be changed while the room is waiting.",
    });
    expect(session.maxParticipants).toBe(4);
    expect(session.save).not.toHaveBeenCalled();
  });

  test("Prevents changing selections per user after selection starts", async () => {
    const req = {
      userId: "host1",
      params: { sessionId: "session123" },
      body: {
        maxParticipants: 4,
        maxSelectionsPerUser: 2,
      },
    };
    const res = createMockRes();
    const session = createMockSession({
      status: "selecting",
      maxSelectionsPerUser: 5,
    });

    mockFindById(session);

    await updateSession(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: "Selections per user cannot be changed after selection starts.",
    });
    expect(session.maxSelectionsPerUser).toBe(5);
    expect(session.save).not.toHaveBeenCalled();
  });
});

describe("sessionController.updateSessionStatus", () => {
  test("Allows host to start the session and move it from waiting to questioning", async () => {
    const req = {
      userId: "host1",
      params: { sessionId: "session123" },
      body: { status: "questioning" },
    };
    const res = createMockRes();
    const session = createMockSession({ status: "waiting" });

    mockFindById(session);

    await updateSessionStatus(req, res);

    expect(Session.findById).toHaveBeenCalledWith("session123");
    expect(session.status).toBe("questioning");
    expect(session.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      session: expect.objectContaining({
        id: "session123",
        status: "questioning",
        currentUserRole: "host",
      }),
    });
  });

  test("Normalizes status text before updating the session", async () => {
    const req = {
      userId: "host1",
      params: { sessionId: "session123" },
      body: { status: " QUESTIONING " },
    };
    const res = createMockRes();
    const session = createMockSession({ status: "waiting" });

    mockFindById(session);

    await updateSessionStatus(req, res);

    expect(session.status).toBe("questioning");
    expect(session.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      session: expect.objectContaining({
        status: "questioning",
      }),
    });
  });

  test("Returns 400 if host tries to update to an invalid session status", async () => {
    const req = {
      userId: "host1",
      params: { sessionId: "session123" },
      body: { status: "started" },
    };
    const res = createMockRes();

    await updateSessionStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message:
        "Status must be one of: waiting, questioning, generating, selecting, spinning, voting, completed.",
    });
    expect(Session.findById).not.toHaveBeenCalled();
  });

  test("Returns 403 if non-host tries to start the session", async () => {
    const req = {
      userId: "user1",
      params: { sessionId: "session123" },
      body: { status: "questioning" },
    };
    const res = createMockRes();
    const session = createMockSession({ status: "waiting" });

    mockFindById(session);

    await updateSessionStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      message: "Only the room creator can update the room status.",
    });
    expect(session.status).toBe("waiting");
    expect(session.save).not.toHaveBeenCalled();
  });

  test("Returns 404 if host starts a room that no longer exists", async () => {
    const req = {
      userId: "host1",
      params: { sessionId: "missing-session" },
      body: { status: "questioning" },
    };
    const res = createMockRes();

    mockFindById(null);

    await updateSessionStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "Room not found.",
    });
  });

  test("Returns 500 if fetching session for status update fails", async () => {
    const req = {
      userId: "host1",
      params: { sessionId: "session123" },
      body: { status: "questioning" },
    };
    const res = createMockRes();

    Session.findById.mockImplementation(() => {
      throw new Error("Status lookup failed.");
    });

    await updateSessionStatus(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Status lookup failed.",
    });
  });

  test("Returns 500 if saving updated session status fails", async () => {
    const req = {
      userId: "host1",
      params: { sessionId: "session123" },
      body: { status: "questioning" },
    };
    const res = createMockRes();
    const session = createMockSession({ status: "waiting" });

    session.save.mockRejectedValue(new Error("Status save failed."));
    mockFindById(session);

    await updateSessionStatus(req, res);

    expect(session.status).toBe("questioning");
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Status save failed.",
    });
  });
});

describe("sessionController.checkIsHost", () => {
  test("Returns true when current user is host", async () => {
    const req = {
      userId: "host1",
      params: { sessionId: "session123" },
    };
    const res = createMockRes();
    const session = createSessionObject();

    sessionService.findSessionById.mockResolvedValue(session);
    sessionService.checkValidParticipant.mockReturnValue(true);

    await checkIsHost(req, res);

    expect(sessionService.findSessionById).toHaveBeenCalledWith("session123");
    expect(sessionService.checkValidParticipant).toHaveBeenCalledWith(session, "host1");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ isHost: true });
  });

  test("Returns false when current user is not host", async () => {
    const req = {
      userId: "user1",
      params: { sessionId: "session123" },
    };
    const res = createMockRes();
    const session = createSessionObject();

    sessionService.findSessionById.mockResolvedValue(session);
    sessionService.checkValidParticipant.mockReturnValue(true);

    await checkIsHost(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ isHost: false });
  });

  test("Returns error status when host check fails", async () => {
    const req = {
      userId: "user2",
      params: { sessionId: "session123" },
    };
    const res = createMockRes();

    sessionService.findSessionById.mockRejectedValue(
      createMockError("Session not found.", 404),
    );

    await checkIsHost(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "Session not found.",
    });
  });
});
