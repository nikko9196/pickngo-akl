const request = require("supertest");

const {
  BASE_URL,
  createTestRoom,
  registerTestUser,
} = require("../helpers/apiTestUtils");

describe("Questionnaire Responses API integration with real backend and MongoDB", () => {
  test("POST /api/sessions/:sessionId/responses submits or updates one participant answer", async () => {
    const host = await registerTestUser("response_host");
    const session = await createTestRoom(host.token);

    await request(BASE_URL)
      .patch(`/api/sessions/${session.id}/status`)
      .set("Authorization", `Bearer ${host.token}`)
      .send({
        status: "questioning",
      });

    const response = await request(BASE_URL)
      .post(`/api/sessions/${session.id}/responses`)
      .set("Authorization", `Bearer ${host.token}`)
      .send({
        questionId: " q1 ",
        answer: " Sushi ",
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.response).toEqual(
      expect.objectContaining({
        sessionId: session.id,
        userId: host.user.id,
        questionId: "q1",
        answer: "Sushi",
        skipped: false,
      }),
    );
  });
});
