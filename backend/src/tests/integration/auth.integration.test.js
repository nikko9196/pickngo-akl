const request = require("supertest");

const {
  BASE_URL,
  registerTestUser,
} = require("../helpers/apiTestUtils");

describe("Auth API integration with real backend and MongoDB", () => {
  test("POST /api/auth/register creates a local user", async () => {
    const email = `register_${Date.now()}_${Math.floor(Math.random() * 100000)}@example.com`;

    const response = await request(BASE_URL)
      .post("/api/auth/register")
      .send({
        email,
        password: "password123",
      });

    expect(response.statusCode).toBe(201);
    expect(response.body.token).toBeTruthy();
    expect(response.body.user).toEqual(
      expect.objectContaining({
        email,
        displayName: email.split("@")[0],
        authProviders: ["local"],
        isGuest: false,
      }),
    );
  });

  test("POST /api/auth/login signs in a registered local user", async () => {
    const user = await registerTestUser("login");

    const response = await request(BASE_URL)
      .post("/api/auth/login")
      .send({
        email: user.email,
        password: user.password,
      });

    expect(response.statusCode).toBe(200);
    expect(response.body.token).toBeTruthy();
    expect(response.body.user).toEqual(
      expect.objectContaining({
        email: user.email,
        authProviders: ["local"],
      }),
    );
  });

  test("POST /api/auth/google validates that credential is required", async () => {
    const response = await request(BASE_URL)
      .post("/api/auth/google")
      .send({});

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({
      message: "Google credential is required.",
    });
  });

  test("POST /api/auth/guest creates and signs in a guest user", async () => {
    const response = await request(BASE_URL).post("/api/auth/guest").send({});

    expect(response.statusCode).toBe(201);
    expect(response.body.token).toBeTruthy();
    expect(response.body.user).toEqual(
      expect.objectContaining({
        isGuest: true,
        authProviders: ["guest"],
      }),
    );
    expect(response.body.user.email).toContain("@guest.haveabyte.local");
  });

  test("GET /api/auth/me returns 401 without auth token", async () => {
    const response = await request(BASE_URL).get("/api/auth/me");

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({
      message: "Authentication is required.",
    });
  });

  test("GET /api/auth/me returns the current authenticated user", async () => {
    const user = await registerTestUser("me");

    const response = await request(BASE_URL)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${user.token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.user).toEqual(
      expect.objectContaining({
        id: user.user.id,
        email: user.email,
      }),
    );
  });
});
