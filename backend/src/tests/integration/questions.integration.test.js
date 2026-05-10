const request = require("supertest");

const QuestionList = require("../../models/QuestionList");
const {
  createTestApp,
  createToken,
  mockSortedQuestionLists,
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
  jest.restoreAllMocks();
});

describe("Questions API integration", () => {
  test("GET /api/questions returns 401 without auth token", async () => {
    const app = createTestApp();

    const response = await request(app).get("/api/questions");

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({
      message: "Authentication is required.",
    });
    expect(QuestionList.find).not.toHaveBeenCalled();
  });

  test("GET /api/questions accepts valid token and returns controller response", async () => {
    const app = createTestApp();

    jest.spyOn(Math, "random").mockReturnValue(0);
    mockSortedQuestionLists([
      {
        questionListId: "food-type",
        category: "Food Type",
        isActive: true,
        questionList: [
          {
            questionId: "q1",
            questionType: "single",
            questionText: "What food do you want?",
            questionValue: [{ optionLabel: "A", optionText: "Sushi" }],
          },
        ],
      },
    ]);

    const response = await request(app)
      .get("/api/questions")
      .set("Authorization", `Bearer ${createToken("user1")}`);

    expect(response.statusCode).toBe(200);
    expect(QuestionList.find).toHaveBeenCalledWith({ isActive: true });
    expect(response.body).toEqual({
      questionLists: [
        {
          questionListId: "food-type",
          category: "Food Type",
          isActive: true,
          questionList: [
            {
              questionId: "q1",
              questionType: "single",
              questionText: "What food do you want?",
              questionValue: [{ optionLabel: "A", optionText: "Sushi" }],
            },
          ],
        },
      ],
    });
  });
});
