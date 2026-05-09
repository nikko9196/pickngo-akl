const request = require("supertest");
const { BASE_URL, registerTestUser } = require("../helpers/authHelper");

describe("Integration test: Create Session", () => {
  test("Register a user and create a session", async () => {
    const { token } = await registerTestUser("Host Test Account");

    const response = await request(BASE_URL)
      .post("/api/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        roomDisplayName: "Host Test",
        maxParticipants: 4,
        maxSelectionsPerUser: 3,
      });

    expect(response.statusCode).toBeGreaterThanOrEqual(200);
    expect(response.statusCode).toBeLessThan(300);

    expect(response.body.session).toBeTruthy();
    expect(response.body.session.sessionCode).toBeTruthy();
    expect(response.body.session.status).toBe("waiting");
    expect(response.body.session.participantCount).toBeGreaterThanOrEqual(1);
  });
});
