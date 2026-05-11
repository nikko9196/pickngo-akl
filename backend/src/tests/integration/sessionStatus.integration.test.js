const request = require("supertest");
const { BASE_URL, registerTestUser } = require("../helpers/authHelper");

async function createTestSession(token, overrides = {}) {
  const response = await request(BASE_URL)
    .post("/api/sessions")
    .set("Authorization", `Bearer ${token}`)
    .send({
      roomDisplayName: "Host Test",
      maxParticipants: 4,
      maxSelectionsPerUser: 3,
      ...overrides,
    });

  expect(response.statusCode).toBeGreaterThanOrEqual(200);
  expect(response.statusCode).toBeLessThan(300);
  expect(response.body.session).toBeTruthy();

  return response.body.session;
}

describe("Integration test: Update session status", () => {
  // Test: Successful case:
  test("Allows host to update session status.", async () => {
    const host = await registerTestUser("Host Test Account");
    const session = await createTestSession(host.token);

    const response = await request(BASE_URL)
      .patch(`/api/sessions/${session.id}/status`)
      .set("Authorization", `Bearer ${host.token}`)
      .send({
        status: "questioning",
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.session).toBeTruthy();
    expect(response.body.session.id).toBe(session.id);
    expect(response.body.session.status).toBe("questioning");
  });

  // Test: No token when updating session status:
  test("Returns 401 when updating session status without authentication.", async () => {
    const host = await registerTestUser("Host Test Account");
    const session = await createTestSession(host.token);

    const response = await request(BASE_URL)
      .patch(`/api/sessions/${session.id}/status`)
      .send({
        status: "questioning",
      });

    expect(response.statusCode).toBe(401);
  });

  // Test: Member tries to update status:
  test("Returns 403 when non-host tries to update session status.", async () => {
    const host = await registerTestUser("Host Test Account");
    const member = await registerTestUser("Member Test Account");
    const session = await createTestSession(host.token);

    const joinResponse = await request(BASE_URL)
      .post("/api/sessions/join")
      .set("Authorization", `Bearer ${member.token}`)
      .send({
        sessionCode: session.sessionCode,
        roomDisplayName: "Member Test",
      });

    expect(joinResponse.statusCode).toBeGreaterThanOrEqual(200);
    expect(joinResponse.statusCode).toBeLessThan(300);

    const response = await request(BASE_URL)
      .patch(`/api/sessions/${session.id}/status`)
      .set("Authorization", `Bearer ${member.token}`)
      .send({
        status: "questioning",
      });

    expect(response.statusCode).toBe(403);
    expect(response.body.message).toBe(
      "Only the room creator can update the room status.",
    );
  });

  // Test: Invalid session status:
  test("Returns 400 when session status is invalid.", async () => {
    const host = await registerTestUser("Host Test Account");
    const session = await createTestSession(host.token);

    const response = await request(BASE_URL)
      .patch(`/api/sessions/${session.id}/status`)
      .set("Authorization", `Bearer ${host.token}`)
      .send({
        status: "invalid",
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toContain("Status must be one of:");
  });
});
