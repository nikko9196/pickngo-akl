const jwt = require("jsonwebtoken");

jest.mock("../src/services/recommendationService", () => ({
  generateRecommendationsForSession: jest.fn(),
  getLatestRecommendationsForSession: jest.fn(),
}));

const {
  generateSessionRecommendations,
  getLatestSessionRecommendations,
} = require("../src/controllers/recommendationController");
const { requireAuth } = require("../src/middleware/auth");
const { JWT_SECRET } = require("../src/services/authService");
const {
  generateRecommendationsForSession,
  getLatestRecommendationsForSession,
} = require("../src/services/recommendationService");
const HttpError = require("../src/utils/httpError");

function createToken(userId = "user-1") {
  return jwt.sign({ sub: userId, email: `${userId}@example.com` }, JWT_SECRET, {
    expiresIn: "1h",
  });
}

function createMockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
}

describe("recommendation endpoint contracts", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/sessions/:sessionId/recommendations", () => {
    test("returns 201 and passes refresh=false by default", async () => {
      const req = {
        params: { sessionId: "session-1" },
        query: {},
        userId: "user-1",
      };
      const res = createMockRes();

      generateRecommendationsForSession.mockResolvedValue({
        cached: false,
        message: "Generated group recommendations.",
        snapshot: { sessionId: "session-1", restaurants: [] },
        sessionStatus: "selecting",
      });

      await generateSessionRecommendations(req, res);

      expect(generateRecommendationsForSession).toHaveBeenCalledWith({
        sessionId: "session-1",
        requesterUserId: "user-1",
        refresh: false,
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        cached: false,
        message: "Generated group recommendations.",
        snapshot: { sessionId: "session-1", restaurants: [] },
        sessionStatus: "selecting",
      });
    });

    test("returns 200 and passes refresh=true when refresh query is set", async () => {
      const req = {
        params: { sessionId: "session-1" },
        query: { refresh: "true" },
        userId: "user-1",
      };
      const res = createMockRes();

      generateRecommendationsForSession.mockResolvedValue({
        cached: true,
        message: "Returning the most recent recommendation snapshot.",
        snapshot: { sessionId: "session-1", restaurants: [] },
        sessionStatus: "generating",
      });

      await generateSessionRecommendations(req, res);

      expect(generateRecommendationsForSession).toHaveBeenCalledWith({
        sessionId: "session-1",
        requesterUserId: "user-1",
        refresh: true,
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        cached: true,
        message: "Returning the most recent recommendation snapshot.",
        snapshot: { sessionId: "session-1", restaurants: [] },
        sessionStatus: "generating",
      });
    });

    test("returns 409 when the service rejects with a session-state error", async () => {
      const req = {
        params: { sessionId: "session-1" },
        query: {},
        userId: "user-1",
      };
      const res = createMockRes();

      generateRecommendationsForSession.mockRejectedValue(
        new HttpError(
          409,
          "Recommendations can only be generated when the room status is generating."
        )
      );

      await generateSessionRecommendations(req, res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({
        message:
          "Recommendations can only be generated when the room status is generating.",
      });
    });
  });

  describe("GET /api/sessions/:sessionId/recommendations/latest", () => {
    test("returns 200 with the latest snapshot when one exists", async () => {
      const req = {
        params: { sessionId: "session-1" },
        userId: "user-1",
      };
      const res = createMockRes();

      getLatestRecommendationsForSession.mockResolvedValue({
        message: "Fetched the latest recommendation snapshot.",
        snapshot: {
          sessionId: "session-1",
          restaurants: [{ placeId: "place-1", name: "Tanuki's Cave" }],
        },
        sessionStatus: "selecting",
      });

      await getLatestSessionRecommendations(req, res);

      expect(getLatestRecommendationsForSession).toHaveBeenCalledWith({
        sessionId: "session-1",
        requesterUserId: "user-1",
      });
      expect(res.json).toHaveBeenCalledWith({
        message: "Fetched the latest recommendation snapshot.",
        snapshot: {
          sessionId: "session-1",
          restaurants: [{ placeId: "place-1", name: "Tanuki's Cave" }],
        },
        sessionStatus: "selecting",
      });
    });

    test("returns 200 with snapshot:null when no recommendation snapshot exists yet", async () => {
      const req = {
        params: { sessionId: "session-1" },
        userId: "user-1",
      };
      const res = createMockRes();

      getLatestRecommendationsForSession.mockResolvedValue({
        message: "No recommendation snapshot has been generated yet.",
        snapshot: null,
        sessionStatus: "generating",
      });

      await getLatestSessionRecommendations(req, res);

      expect(res.json).toHaveBeenCalledWith({
        message: "No recommendation snapshot has been generated yet.",
        snapshot: null,
        sessionStatus: "generating",
      });
    });

    test("returns 403 when the service rejects with a participant access error", async () => {
      const req = {
        params: { sessionId: "session-1" },
        userId: "user-2",
      };
      const res = createMockRes();

      getLatestRecommendationsForSession.mockRejectedValue(
        new HttpError(403, "You are not a participant in this room.")
      );

      await getLatestSessionRecommendations(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        message: "You are not a participant in this room.",
      });
    });
  });

  describe("requireAuth middleware for recommendation endpoints", () => {
    test("returns 401 when the Authorization header is missing", () => {
      const req = {
        headers: {},
      };
      const res = createMockRes();
      const next = jest.fn();

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        message: "Authentication is required.",
      });
      expect(next).not.toHaveBeenCalled();
    });

    test("adds req.userId and calls next when the bearer token is valid", () => {
      const req = {
        headers: {
          authorization: `Bearer ${createToken("user-9")}`,
        },
      };
      const res = createMockRes();
      const next = jest.fn();

      requireAuth(req, res, next);

      expect(req.userId).toBe("user-9");
      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
