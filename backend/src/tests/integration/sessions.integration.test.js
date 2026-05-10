const request = require("supertest");

const QuestionList = require("../../models/QuestionList");
const Response = require("../../models/Response");
const Session = require("../../models/Session");
const {
  createMockSession,
  createTestApp,
  createToken,
  mockFind,
  mockFindById,
  mockFindOne,
} = require("./helpers/apiTestUtils");

jest.mock("../../services/authService", () => ({
  createGuestUser: jest.fn(),
  getUserById: jest.fn(),
  loginLocalUser: jest.fn(),
  loginWithGoogle: jest.fn(),
  registerLocalUser: jest.fn(),
  JWT_SECRET: "test-secret",
}));

jest.mock("../../models/QuestionList");
jest.mock("../../models/Response");
jest.mock("../../models/Session");

beforeEach(() => {
  jest.clearAllMocks();
  Session.exists.mockResolvedValue(false);
});

describe("Sessions API integration", () => {
  test("POST /api/sessions returns 401 without auth token", async () => {
    const app = createTestApp();

    const response = await request(app).post("/api/sessions").send({
      roomDisplayName: "Host",
      maxParticipants: 4,
      maxSelectionsPerUser: 3,
    });

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({
      message: "Authentication is required.",
    });
    expect(Session.create).not.toHaveBeenCalled();
  });

  test("POST /api/sessions accepts valid token and passes JSON body to create room controller", async () => {
    const app = createTestApp();
    const createdSession = {
      _id: {
        toString: () => "session123",
      },
    };
    const populatedSession = createMockSession();

    Session.create.mockResolvedValue(createdSession);
    mockFindById(populatedSession);

    const response = await request(app)
      .post("/api/sessions")
      .set("Authorization", `Bearer ${createToken("host1")}`)
      .send({
        roomDisplayName: "Host",
        maxParticipants: 4,
        maxSelectionsPerUser: 3,
        location: {
          source: "map",
          lat: -36.8485,
          lng: 174.7633,
          radiusMeters: 3000,
        },
      });

    expect(response.statusCode).toBe(201);
    expect(Session.create).toHaveBeenCalledWith(
      expect.objectContaining({
        hostUserId: "host1",
        maxParticipants: 4,
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
            userId: "host1",
            role: "host",
            roomDisplayName: "Host",
          },
        ],
      }),
    );
    expect(response.body.session).toEqual(
      expect.objectContaining({
        id: "session123",
        currentUserRole: "host",
      }),
    );
  });

  test("POST /api/sessions/join is mounted, authenticates token, and normalizes sessionCode", async () => {
    const app = createTestApp();
    const session = createMockSession({
      participants: [
        {
          userId: {
            toString: () => "host1",
          },
          role: "host",
          roomDisplayName: "Host",
        },
      ],
    });

    mockFindOne(session);

    const response = await request(app)
      .post("/api/sessions/join")
      .set("Authorization", `Bearer ${createToken("user1")}`)
      .send({
        sessionCode: " abc123 ",
        roomDisplayName: "Member",
      });

    expect(response.statusCode).toBe(200);
    expect(Session.findOne).toHaveBeenCalledWith({ sessionCode: "ABC123" });
    expect(session.participants[1]).toEqual({
      userId: "user1",
      role: "member",
      roomDisplayName: "Member",
    });
    expect(session.save).toHaveBeenCalled();
    expect(response.body.session).toEqual(
      expect.objectContaining({
        currentUserRole: "member",
        participantCount: 2,
      }),
    );
  });

  test("GET /api/sessions/mine returns all rooms for the current user", async () => {
    const app = createTestApp();
    const session = createMockSession({
      participants: [
        {
          userId: {
            toString: () => "user1",
          },
          role: "host",
          roomDisplayName: "User 1",
        },
      ],
    });

    mockFind([session]);

    const response = await request(app)
      .get("/api/sessions/mine")
      .set("Authorization", `Bearer ${createToken("user1")}`);

    expect(response.statusCode).toBe(200);
    expect(Session.find).toHaveBeenCalledWith({
      "participants.userId": "user1",
    });
    expect(response.body.sessions).toEqual([
      expect.objectContaining({
        id: "session123",
        currentUserRole: "host",
        currentUserRoomDisplayName: "User 1",
      }),
    ]);
  });

  test("GET /api/sessions/code/:sessionCode returns a room by public code", async () => {
    const app = createTestApp();
    const session = createMockSession({
      participants: [
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

    const response = await request(app)
      .get("/api/sessions/code/abc123")
      .set("Authorization", `Bearer ${createToken("user1")}`);

    expect(response.statusCode).toBe(200);
    expect(Session.findOne).toHaveBeenCalledWith({
      sessionCode: "ABC123",
      "participants.userId": "user1",
    });
    expect(response.body.session).toEqual(
      expect.objectContaining({
        id: "session123",
        sessionCode: "ABC123",
        currentUserRole: "member",
      }),
    );
  });

  test("GET /api/sessions/:sessionId/progress returns questionnaire completion progress", async () => {
    const app = createTestApp();
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

    mockFindById(session);
    QuestionList.countDocuments.mockResolvedValue(2);
    Response.aggregate.mockResolvedValue([
      { _id: "host1", answeredCount: 2 },
      { _id: "user1", answeredCount: 1 },
    ]);

    const response = await request(app)
      .get("/api/sessions/session123/progress")
      .set("Authorization", `Bearer ${createToken("user1")}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.progress).toEqual({
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
    });
  });

  test("PATCH /api/sessions/:sessionId updates room settings as host", async () => {
    const app = createTestApp();
    const session = createMockSession({
      maxParticipants: 4,
      maxSelectionsPerUser: 3,
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

    mockFindById(session);

    const response = await request(app)
      .patch("/api/sessions/session123")
      .set("Authorization", `Bearer ${createToken("host1")}`)
      .send({
        maxParticipants: 5,
        maxSelectionsPerUser: 4,
      });

    expect(response.statusCode).toBe(200);
    expect(session.maxParticipants).toBe(5);
    expect(session.maxSelectionsPerUser).toBe(4);
    expect(session.save).toHaveBeenCalled();
    expect(response.body.session).toEqual(
      expect.objectContaining({
        maxParticipants: 5,
        maxSelectionsPerUser: 4,
      }),
    );
  });

  test("PATCH /api/sessions/:sessionId/status lets host token start the session", async () => {
    const app = createTestApp();
    const session = createMockSession({
      status: "waiting",
    });

    mockFindById(session);

    const response = await request(app)
      .patch("/api/sessions/session123/status")
      .set("Authorization", `Bearer ${createToken("host1")}`)
      .send({
        status: "questioning",
      });

    expect(response.statusCode).toBe(200);
    expect(Session.findById).toHaveBeenCalledWith("session123");
    expect(session.status).toBe("questioning");
    expect(session.save).toHaveBeenCalled();
    expect(response.body.session).toEqual(
      expect.objectContaining({
        id: "session123",
        status: "questioning",
        currentUserRole: "host",
      }),
    );
  });

  test("DELETE /api/sessions/:sessionId deletes a room as host", async () => {
    const app = createTestApp();
    const session = createMockSession();

    mockFindById(session);

    const response = await request(app)
      .delete("/api/sessions/session123")
      .set("Authorization", `Bearer ${createToken("host1")}`);

    expect(response.statusCode).toBe(204);
    expect(Session.findById).toHaveBeenCalledWith("session123");
    expect(session.deleteOne).toHaveBeenCalled();
  });
});
