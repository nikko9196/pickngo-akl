const request = require("supertest");

const QuestionList = require("../../models/QuestionList");
const Response = require("../../models/Response");
const {
  createMockSession,
  createTestApp,
  createToken,
  mockFindByIdSelect,
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
});

describe("Questionnaire Responses API integration", () => {
  test("POST /api/sessions/:sessionId/responses submits one participant answer", async () => {
    const app = createTestApp();
    const savedResponse = {
      sessionId: "session123",
      userId: "user1",
      questionId: "q1",
      answer: "Sushi",
      skipped: false,
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    const progressSession = createMockSession({
      status: "questioning",
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

    Response.findOneAndUpdate.mockResolvedValue(savedResponse);
    mockFindByIdSelect(progressSession);
    QuestionList.countDocuments.mockResolvedValue(2);
    Response.aggregate.mockResolvedValue([{ _id: "user1", answeredCount: 1 }]);

    const response = await request(app)
      .post("/api/sessions/session123/responses")
      .set("Authorization", `Bearer ${createToken("user1")}`)
      .send({
        questionId: " q1 ",
        answer: " Sushi ",
      });

    expect(response.statusCode).toBe(200);
    expect(Response.findOneAndUpdate).toHaveBeenCalledWith(
      {
        sessionId: "session123",
        userId: "user1",
        questionId: "q1",
      },
      {
        $set: {
          answer: "Sushi",
          skipped: false,
        },
        $setOnInsert: {
          sessionId: "session123",
          userId: "user1",
          questionId: "q1",
        },
      },
      {
        returnDocument: "after",
        upsert: true,
        runValidators: true,
        setDefaultsOnInsert: true,
      },
    );
    expect(response.body.response).toEqual(savedResponse);
  });
});
