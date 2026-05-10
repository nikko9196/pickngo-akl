const request = require("supertest");

const authService = require("../../services/authService");
const {
  createTestApp,
  createToken,
} = require("./helpers/apiTestUtils");

jest.mock("../../services/authService", () => ({
  createGuestUser: jest.fn(),
  getUserById: jest.fn(),
  loginLocalUser: jest.fn(),
  loginWithGoogle: jest.fn(),
  registerLocalUser: jest.fn(),
  JWT_SECRET: "test-secret",
}));

jest.mock("../../models/QuestionList");
jest.mock("../../models/Response");
jest.mock("../../models/Session");

beforeEach(() => {
  jest.clearAllMocks();
});

describe("Auth API integration", () => {
  test("POST /api/auth/register is mounted and passes JSON body to auth controller", async () => {
    const app = createTestApp();

    authService.registerLocalUser.mockResolvedValue({
      token: "register-token",
      user: {
        id: "user1",
        email: "user@example.com",
      },
    });

    const response = await request(app)
      .post("/api/auth/register")
      .send({
        email: "user@example.com",
        password: "password123",
      });

    expect(response.statusCode).toBe(201);
    expect(authService.registerLocalUser).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "password123",
    });
    expect(response.body).toEqual({
      token: "register-token",
      user: {
        id: "user1",
        email: "user@example.com",
      },
    });
  });

  test("POST /api/auth/login is mounted and passes JSON body to auth controller", async () => {
    const app = createTestApp();

    authService.loginLocalUser.mockResolvedValue({
      token: "login-token",
      user: {
        id: "user1",
        email: "user@example.com",
      },
    });

    const response = await request(app)
      .post("/api/auth/login")
      .send({
        email: "user@example.com",
        password: "password123",
      });

    expect(response.statusCode).toBe(200);
    expect(authService.loginLocalUser).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "password123",
    });
    expect(response.body).toEqual({
      token: "login-token",
      user: {
        id: "user1",
        email: "user@example.com",
      },
    });
  });

  test("POST /api/auth/google is mounted and passes credential to auth controller", async () => {
    const app = createTestApp();

    authService.loginWithGoogle.mockResolvedValue({
      token: "google-token",
      user: {
        id: "google-user",
        email: "google@example.com",
      },
    });

    const response = await request(app)
      .post("/api/auth/google")
      .send({
        credential: "google-credential",
      });

    expect(response.statusCode).toBe(200);
    expect(authService.loginWithGoogle).toHaveBeenCalledWith("google-credential");
    expect(response.body).toEqual({
      token: "google-token",
      user: {
        id: "google-user",
        email: "google@example.com",
      },
    });
  });

  test("POST /api/auth/guest is mounted and creates a guest user", async () => {
    const app = createTestApp();

    authService.createGuestUser.mockResolvedValue({
      token: "guest-token",
      user: {
        id: "guest1",
        isGuest: true,
      },
    });

    const response = await request(app).post("/api/auth/guest").send({});

    expect(response.statusCode).toBe(201);
    expect(authService.createGuestUser).toHaveBeenCalled();
    expect(response.body).toEqual({
      token: "guest-token",
      user: {
        id: "guest1",
        isGuest: true,
      },
    });
  });

  test("GET /api/auth/me returns 401 without auth token", async () => {
    const app = createTestApp();

    const response = await request(app).get("/api/auth/me");

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({
      message: "Authentication is required.",
    });
    expect(authService.getUserById).not.toHaveBeenCalled();
  });

  test("GET /api/auth/me accepts valid token and returns current user", async () => {
    const app = createTestApp();

    authService.getUserById.mockResolvedValue({
      id: "user1",
      email: "user1@example.com",
    });

    const response = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${createToken("user1")}`);

    expect(response.statusCode).toBe(200);
    expect(authService.getUserById).toHaveBeenCalledWith("user1");
    expect(response.body).toEqual({
      user: {
        id: "user1",
        email: "user1@example.com",
      },
    });
  });
});
