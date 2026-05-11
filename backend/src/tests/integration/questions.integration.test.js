const request = require("supertest");

const {
  BASE_URL,
  registerTestUser,
} = require("../helpers/apiTestUtils");

describe("Questions API integration with real backend and MongoDB", () => {
  test("GET /api/questions returns 401 without auth token", async () => {
    const response = await request(BASE_URL).get("/api/questions");

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({
      message: "Authentication is required.",
    });
  });

  test("GET /api/questions returns active question lists from the configured database", async () => {
    const user = await registerTestUser("questions");

    const response = await request(BASE_URL)
      .get("/api/questions")
      .set("Authorization", `Bearer ${user.token}`);

    expect(response.statusCode).toBe(200);
    expect(Array.isArray(response.body.questionLists)).toBe(true);

    if (response.body.questionLists.length > 0) {
      expect(response.body.questionLists[0]).toEqual(
        expect.objectContaining({
          questionListId: expect.any(String),
          category: expect.any(String),
          isActive: true,
          questionList: expect.any(Array),
        }),
      );
    }
  });
});
