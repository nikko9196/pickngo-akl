const request = require("supertest");

const {
  BASE_URL,
  createTestRoom,
  registerTestUser,
} = require("../helpers/apiTestUtils");

describe("Sessions API integration with real backend and MongoDB", () => {
  test("POST /api/sessions returns 401 without auth token", async () => {
    const response = await request(BASE_URL).post("/api/sessions").send({
      roomDisplayName: "Host",
      maxParticipants: 4,
      maxSelectionsPerUser: 3,
    });

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({
      message: "Authentication is required.",
    });
  });

  test("POST /api/sessions creates a room and stores the host participant", async () => {
    const host = await registerTestUser("session_host");

    const response = await request(BASE_URL)
      .post("/api/sessions")
      .set("Authorization", `Bearer ${host.token}`)
      .send({
        roomDisplayName: "Host",
        maxParticipants: 4,
        maxSelectionsPerUser: 3,
        location: {
          source: "map",
          lat: -36.8485,
          lng: 174.7633,
          radiusMeters: 3000,
        },
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.session).toEqual(
      expect.objectContaining({
        hostUserId: host.user.id,
        status: "waiting",
        currentUserRole: "host",
        currentUserRoomDisplayName: "Host",
        participantCount: 1,
      }),
    );
  });

  test("POST /api/sessions/join lets another user join by session code", async () => {
    const host = await registerTestUser("join_host");
    const member = await registerTestUser("join_member");
    const session = await createTestRoom(host.token);

    const response = await request(BASE_URL)
      .post("/api/sessions/join")
      .set("Authorization", `Bearer ${member.token}`)
      .send({
        sessionCode: ` ${session.sessionCode.toLowerCase()} `,
        roomDisplayName: "Member",
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.session).toEqual(
      expect.objectContaining({
        currentUserRole: "member",
        currentUserRoomDisplayName: "Member",
        participantCount: 2,
      }),
    );
  });

  test("GET /api/sessions/mine returns all rooms for the current user", async () => {
    const host = await registerTestUser("mine_host");
    const session = await createTestRoom(host.token);

    const response = await request(BASE_URL)
      .get("/api/sessions/mine")
      .set("Authorization", `Bearer ${host.token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.sessions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: session.id,
          currentUserRole: "host",
          currentUserRoomDisplayName: "Host",
        }),
      ]),
    );
  });

  test("GET /api/sessions/code/:sessionCode returns a participant's room by public code", async () => {
    const host = await registerTestUser("code_host");
    const session = await createTestRoom(host.token);

    const response = await request(BASE_URL)
      .get(`/api/sessions/code/${session.sessionCode.toLowerCase()}`)
      .set("Authorization", `Bearer ${host.token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.session).toEqual(
      expect.objectContaining({
        id: session.id,
        sessionCode: session.sessionCode,
        currentUserRole: "host",
      }),
    );
  });

  test("GET /api/sessions/:sessionId/progress returns questionnaire completion progress", async () => {
    const host = await registerTestUser("progress_host");
    const session = await createTestRoom(host.token);

    const response = await request(BASE_URL)
      .get(`/api/sessions/${session.id}/progress`)
      .set("Authorization", `Bearer ${host.token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.progress).toEqual(
      expect.objectContaining({
        sessionId: session.id,
        totalParticipants: 1,
        completedCount: expect.any(Number),
        pendingCount: expect.any(Number),
        allComplete: expect.any(Boolean),
        participants: [
          expect.objectContaining({
            userId: host.user.id,
            roomDisplayName: "Host",
            answeredCount: expect.any(Number),
            isComplete: expect.any(Boolean),
          }),
        ],
      }),
    );
  });

  test("PATCH /api/sessions/:sessionId updates room settings as host", async () => {
    const host = await registerTestUser("settings_host");
    const session = await createTestRoom(host.token);

    const response = await request(BASE_URL)
      .patch(`/api/sessions/${session.id}`)
      .set("Authorization", `Bearer ${host.token}`)
      .send({
        maxParticipants: 5,
        maxSelectionsPerUser: 4,
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.session).toEqual(
      expect.objectContaining({
        maxParticipants: 5,
        maxSelectionsPerUser: 4,
      }),
    );
  });

  test("PATCH /api/sessions/:sessionId/status lets host start the session", async () => {
    const host = await registerTestUser("status_host");
    const session = await createTestRoom(host.token);

    const response = await request(BASE_URL)
      .patch(`/api/sessions/${session.id}/status`)
      .set("Authorization", `Bearer ${host.token}`)
      .send({
        status: "questioning",
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.session).toEqual(
      expect.objectContaining({
        id: session.id,
        status: "questioning",
        currentUserRole: "host",
      }),
    );
  });

  test("DELETE /api/sessions/:sessionId deletes a room as host", async () => {
    const host = await registerTestUser("delete_host");
    const session = await createTestRoom(host.token);

    const response = await request(BASE_URL)
      .delete(`/api/sessions/${session.id}`)
      .set("Authorization", `Bearer ${host.token}`);

    expect(response.statusCode).toBe(204);
  });
});
