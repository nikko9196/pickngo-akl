const request = require("supertest");
const { BASE_URL, registerTestUser } = require("../helpers/authHelper");

describe("Integration test: Join session", () => {
  // Test: Successful case:
  test("Allow another user to join a created session.", async () => {
    const host = await registerTestUser("Host Test Account");
    const member = await registerTestUser("Member Test Account");

    const createResponse = await request(BASE_URL)
      .post("/api/sessions")
      .set("Authorization", `Bearer ${host.token}`)
      .send({
        roomDisplayName: "Host Test",
        maxParticipants: 4,
        maxSelectionsPerUser: 3,
      });

    expect(createResponse.statusCode).toBeGreaterThanOrEqual(200);
    expect(createResponse.statusCode).toBeLessThan(300);

    const sessionCode = createResponse.body.session.sessionCode;
    expect(sessionCode).toBeTruthy();

    const joinResponse = await request(BASE_URL)
      .post("/api/sessions/join")
      .set("Authorization", `Bearer ${member.token}`)
      .send({
        sessionCode,
        roomDisplayName: "Member Test",
      });

    expect(joinResponse.statusCode).toBeGreaterThanOrEqual(200);
    expect(joinResponse.statusCode).toBeLessThan(300);

    expect(joinResponse.body.session).toBeTruthy();
    expect(joinResponse.body.session.participantCount).toBeGreaterThanOrEqual(
      2,
    );
  });

  // Test: No token when joining a session:
  test("Returns 401 when joining a session without authentication.", async () => {
    const response = await request(BASE_URL).post("/api/sessions/join").send({
      sessionCode: "ABC123",
      roomDisplayName: "Member Test",
    });

    expect(response.statusCode).toBe(401);
  });

  // Test: Session code does not exist:
  test("Returns 404 when session code does not exist.", async () => {
    const member = await registerTestUser("Member Test Account");

    const response = await request(BASE_URL)
      .post("/api/sessions/join")
      .set("Authorization", `Bearer ${member.token}`)
      .send({
        sessionCode: "ZZTEST",
        roomDisplayName: "Member Test",
      });

    expect(response.statusCode).toBe(404);
    expect(response.body.message).toBe("Room not found.");
  });

  // Test: Missing room display name:
  test("Returns 400 when room display name is missing.", async () => {
    const host = await registerTestUser("Host Test Account");
    const member = await registerTestUser("Member Test Account");

    const createResponse = await request(BASE_URL)
      .post("/api/sessions")
      .set("Authorization", `Bearer ${host.token}`)
      .send({
        roomDisplayName: "Host Test",
        maxParticipants: 4,
        maxSelectionsPerUser: 3,
      });

    const sessionCode = createResponse.body.session.sessionCode;

    const response = await request(BASE_URL)
      .post("/api/sessions/join")
      .set("Authorization", `Bearer ${member.token}`)
      .send({
        sessionCode,
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe(
      "Room display name is required and must be 30 characters or fewer.",
    );
  });

  // Test: Room is already full:
  test("Returns 409 when room is already full.", async () => {
    const host = await registerTestUser("Host Test Account");
    const memberOne = await registerTestUser("Member One");
    const memberTwo = await registerTestUser("Member Two");

    const createResponse = await request(BASE_URL)
      .post("/api/sessions")
      .set("Authorization", `Bearer ${host.token}`)
      .send({
        roomDisplayName: "Host Test",
        maxParticipants: 2,
        maxSelectionsPerUser: 3,
      });

    const sessionCode = createResponse.body.session.sessionCode;

    const joinResponse = await request(BASE_URL)
      .post("/api/sessions/join")
      .set("Authorization", `Bearer ${memberOne.token}`)
      .send({
        sessionCode,
        roomDisplayName: "Member One",
      });

    expect(joinResponse.statusCode).toBeGreaterThanOrEqual(200);
    expect(joinResponse.statusCode).toBeLessThan(300);

    const response = await request(BASE_URL)
      .post("/api/sessions/join")
      .set("Authorization", `Bearer ${memberTwo.token}`)
      .send({
        sessionCode,
        roomDisplayName: "Member Two",
      });

    expect(response.statusCode).toBe(409);
    expect(response.body.message).toBe("This room is already full.");
  });
});
