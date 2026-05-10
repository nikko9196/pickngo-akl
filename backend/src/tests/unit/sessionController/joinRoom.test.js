const { joinSession } = require("../../../controllers/sessionController");
const Session = require("../../../models/Session");

jest.mock("../../../models/Session");
jest.mock("../../../models/Response");
jest.mock("../../../models/QuestionList");

function createMockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
}

function createMockSession(overrides = {}) {
  const sessionObject = {
    _id: {
      toString: () => "session123",
    },
    hostUserId: {
      toString: () => "host1",
    },
    sessionCode: "ABC123",
    joinUrl: "http://localhost:5173/join/ABC123",
    status: "waiting",
    maxParticipants: 3,
    maxSelectionsPerUser: 3,
    location: {
      source: "map",
      label: "",
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
        joinedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };

  return {
    ...sessionObject,
    save: jest.fn().mockResolvedValue(true),
    toObject: jest.fn(() => sessionObject),
  };
}

function mockFindOne(session) {
  Session.findOne.mockReturnValue({
    populate: jest.fn().mockResolvedValue(session),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("sessionController.joinSession", () => {
  test("Returns 400 if session code is missing", async () => {
    const req = {
      userId: "user1",
      body: { roomDisplayName: "User 1" },
    };
    const res = createMockRes();

    await joinSession(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Session code is required.",
    });
    expect(Session.findOne).not.toHaveBeenCalled();
  });

  test("Returns 400 if room display name is missing", async () => {
    const req = {
      userId: "user1",
      body: { sessionCode: "ABC123", roomDisplayName: "   " },
    };
    const res = createMockRes();

    await joinSession(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Room display name is required and must be 30 characters or fewer.",
    });
    expect(Session.findOne).not.toHaveBeenCalled();
  });

  test("Returns 400 if room display name is longer than 30 characters", async () => {
    const req = {
      userId: "user1",
      body: {
        sessionCode: "ABC123",
        roomDisplayName: "A room display name over thirty characters",
      },
    };
    const res = createMockRes();

    await joinSession(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Room display name is required and must be 30 characters or fewer.",
    });
    expect(Session.findOne).not.toHaveBeenCalled();
  });

  test("Returns 404 if room does not exist", async () => {
    const req = {
      userId: "user1",
      body: { sessionCode: "abc123", roomDisplayName: "User 1" },
    };
    const res = createMockRes();

    mockFindOne(null);

    await joinSession(req, res);

    expect(Session.findOne).toHaveBeenCalledWith({ sessionCode: "ABC123" });
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "Room not found.",
    });
  });

  test("Returns 409 if room is no longer waiting", async () => {
    const req = {
      userId: "user1",
      body: { sessionCode: "ABC123", roomDisplayName: "User 1" },
    };
    const res = createMockRes();
    const session = createMockSession({ status: "questioning" });

    mockFindOne(session);

    await joinSession(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: "This room is no longer open for new participants.",
    });
    expect(session.save).not.toHaveBeenCalled();
  });

  test("Returns 409 if room is full", async () => {
    const req = {
      userId: "user2",
      body: { sessionCode: "ABC123", roomDisplayName: "User 2" },
    };
    const res = createMockRes();
    const session = createMockSession({
      maxParticipants: 1,
    });

    mockFindOne(session);

    await joinSession(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: "This room is already full.",
    });
    expect(session.save).not.toHaveBeenCalled();
  });

  test("Joins room successfully as a new participant", async () => {
    const req = {
      userId: "user1",
      body: { sessionCode: "ABC123", roomDisplayName: "User 1" },
    };
    const res = createMockRes();
    const session = createMockSession();

    mockFindOne(session);

    await joinSession(req, res);

    expect(session.participants).toHaveLength(2);
    expect(session.participants[1]).toEqual({
      userId: "user1",
      role: "member",
      roomDisplayName: "User 1",
    });
    expect(session.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      session: expect.objectContaining({
        id: "session123",
        currentUserRole: "member",
        currentUserRoomDisplayName: "User 1",
        participantCount: 2,
      }),
    });
  });

  test("Trims and uppercases session code when joining successfully", async () => {
    const req = {
      userId: "user1",
      body: { sessionCode: " abc123 ", roomDisplayName: "User 1" },
    };
    const res = createMockRes();
    const session = createMockSession();

    mockFindOne(session);

    await joinSession(req, res);

    expect(Session.findOne).toHaveBeenCalledWith({ sessionCode: "ABC123" });
    expect(session.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      session: expect.objectContaining({
        currentUserRole: "member",
        participantCount: 2,
      }),
    });
  });

  test("Returns existing room without duplicating participant if user already joined", async () => {
    const req = {
      userId: "user1",
      body: { sessionCode: "ABC123", roomDisplayName: "User 1 updated" },
    };
    const res = createMockRes();
    const session = createMockSession({
      participants: [
        {
          userId: {
            toString: () => "host1",
          },
          role: "host",
          roomDisplayName: "Host",
        },
        {
          userId: {
            toString: () => "user1",
          },
          role: "member",
          roomDisplayName: "User 1",
        },
      ],
    });

    mockFindOne(session);

    await joinSession(req, res);

    expect(session.participants).toHaveLength(2);
    expect(session.save).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({
      session: expect.objectContaining({
        currentUserRole: "member",
        currentUserRoomDisplayName: "User 1",
        participantCount: 2,
      }),
    });
  });

  test("Allows already joined user to re-enter even when the room is full", async () => {
    const req = {
      userId: "user1",
      body: { sessionCode: "ABC123", roomDisplayName: "User 1" },
    };
    const res = createMockRes();
    const session = createMockSession({
      maxParticipants: 2,
      participants: [
        {
          userId: {
            toString: () => "host1",
          },
          role: "host",
          roomDisplayName: "Host",
        },
        {
          userId: {
            toString: () => "user1",
          },
          role: "member",
          roomDisplayName: "User 1",
        },
      ],
    });

    mockFindOne(session);

    await joinSession(req, res);

    expect(session.participants).toHaveLength(2);
    expect(session.save).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      session: expect.objectContaining({
        currentUserRole: "member",
        participantCount: 2,
      }),
    });
  });

  test("Returns 500 if join room fails", async () => {
    const req = {
      userId: "user1",
      body: { sessionCode: "ABC123", roomDisplayName: "User 1" },
    };
    const res = createMockRes();

    Session.findOne.mockImplementation(() => {
      throw new Error("Database unavailable.");
    });

    await joinSession(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Database unavailable.",
    });
  });
});
