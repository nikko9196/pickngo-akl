const request = require("supertest");
const { BASE_URL, registerTestUser } = require("../helpers/authHelper");

describe("Integration test: Join session", () => {
  test("Allow another user to join a created session", async () => {
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
});
