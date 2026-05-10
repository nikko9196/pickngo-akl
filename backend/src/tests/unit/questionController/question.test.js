const { getActiveQuestionLists } = require("../../../controllers/questionController");
const QuestionList = require("../../../models/QuestionList");

jest.mock("../../../models/QuestionList");

function createMockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
}

function mockSortedQuestionLists(result) {
  QuestionList.find.mockReturnValue({
    sort: jest.fn().mockResolvedValue(result),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

describe("questionController.getActiveQuestionLists", () => {
  test("Returns active question lists with one random question from each list", async () => {
    const req = {};
    const res = createMockRes();

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
            questionValue: [
              { optionLabel: "A", optionText: "Sushi" },
              { optionLabel: "B", optionText: "Pizza" },
            ],
            internalField: "should not be returned",
          },
          {
            questionId: "q2",
            questionType: "single",
            questionText: "How spicy?",
            questionValue: [],
          },
        ],
      },
    ]);

    await getActiveQuestionLists(req, res);

    expect(QuestionList.find).toHaveBeenCalledWith({ isActive: true });
    expect(res.json).toHaveBeenCalledWith({
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
              questionValue: [
                { optionLabel: "A", optionText: "Sushi" },
                { optionLabel: "B", optionText: "Pizza" },
              ],
            },
          ],
        },
      ],
    });
  });

  test("Can randomly select the second question from an active question list", async () => {
    const req = {};
    const res = createMockRes();

    jest.spyOn(Math, "random").mockReturnValue(0.6);
    mockSortedQuestionLists([
      {
        questionListId: "diet",
        category: "Diet",
        isActive: true,
        questionList: [
          {
            questionId: "q1",
            questionType: "single",
            questionText: "Any dietary restrictions?",
            questionValue: [
              { optionLabel: "A", optionText: "None" },
            ],
          },
          {
            questionId: "q2",
            questionType: "single",
            questionText: "Do you want vegetarian options?",
            questionValue: [
              { optionLabel: "A", optionText: "Yes" },
              { optionLabel: "B", optionText: "No" },
            ],
          },
        ],
      },
    ]);

    await getActiveQuestionLists(req, res);

    expect(res.json).toHaveBeenCalledWith({
      questionLists: [
        {
          questionListId: "diet",
          category: "Diet",
          isActive: true,
          questionList: [
            {
              questionId: "q2",
              questionType: "single",
              questionText: "Do you want vegetarian options?",
              questionValue: [
                { optionLabel: "A", optionText: "Yes" },
                { optionLabel: "B", optionText: "No" },
              ],
            },
          ],
        },
      ],
    });
  });

  test("Returns empty questionList when an active category has no questions", async () => {
    const req = {};
    const res = createMockRes();

    mockSortedQuestionLists([
      {
        questionListId: "empty",
        category: "Empty",
        isActive: true,
        questionList: [],
      },
    ]);

    await getActiveQuestionLists(req, res);

    expect(res.json).toHaveBeenCalledWith({
      questionLists: [
        {
          questionListId: "empty",
          category: "Empty",
          isActive: true,
          questionList: [],
        },
      ],
    });
  });

  test("Returns an empty array when there are no active question lists", async () => {
    const req = {};
    const res = createMockRes();

    mockSortedQuestionLists([]);

    await getActiveQuestionLists(req, res);

    expect(res.json).toHaveBeenCalledWith({
      questionLists: [],
    });
  });

  test("Returns 500 if fetching active question lists fails", async () => {
    const req = {};
    const res = createMockRes();

    QuestionList.find.mockReturnValue({
      sort: jest.fn().mockRejectedValue(new Error("Question query failed.")),
    });

    await getActiveQuestionLists(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Question query failed.",
    });
  });
});
