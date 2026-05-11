const request = require("supertest");
const { BASE_URL, registerTestUser } = require("../helpers/authHelper");

describe("Integration test: Create Session", () => {
  // Test: Successful case:
  test("Register a user and create a session.", async () => {
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

  // Test: No token when creating a session:
  test("Returns 401 when creating a session without authentication.", async () => {
    const response = await request(BASE_URL).post("/api/sessions").send({
      roomDisplayName: "Host Test",
      maxParticipants: 4,
      maxSelectionsPerUser: 3,
    });

    expect(response.statusCode).toBe(401);
  });

  // Test: Missing room display name:
  test("Returns 400 when room display name is missing.", async () => {
    const { token } = await registerTestUser("Host Test Account");

    const response = await request(BASE_URL)
      .post("/api/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        maxParticipants: 4,
        maxSelectionsPerUser: 3,
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe(
      "Room display name is required and must be 30 characters or fewer.",
    );
  });

  // Test: Invalid max participants:
  test("Returns 400 when max participants is invalid.", async () => {
    const { token } = await registerTestUser("Host Test Account");

    const response = await request(BASE_URL)
      .post("/api/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        roomDisplayName: "Host Test",
        maxParticipants: 1,
        maxSelectionsPerUser: 3,
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe(
      "Max participants must be an integer between 2 and 50.",
    );
  });

  // Test: Invalid max selections per user:
  test("Returns 400 when max selections per user is invalid.", async () => {
    const { token } = await registerTestUser("Host Test Account");

    const response = await request(BASE_URL)
      .post("/api/sessions")
      .set("Authorization", `Bearer ${token}`)
      .send({
        roomDisplayName: "Host Test",
        maxParticipants: 4,
        maxSelectionsPerUser: 11,
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe(
      "Max selections per user must be an integer between 1 and 10.",
    );
  });
});
