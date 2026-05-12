const {
  guestLogin,
  googleLogin,
  login,
  me,
  register,
} = require("../../../controllers/authController");
const authService = require("../../../services/authService");

jest.mock("../../../services/authService");

function createMockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe("authController.login", () => {
  test("Returns 400 if email is missing", async () => {
    const req = {
      body: { password: "password123" },
    };
    const res = createMockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Email and password are required.",
    });
    expect(authService.loginLocalUser).not.toHaveBeenCalled();
  });

  test("Returns 400 if password is missing", async () => {
    const req = {
      body: { email: "user@example.com" },
    };
    const res = createMockRes();

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Email and password are required.",
    });
    expect(authService.loginLocalUser).not.toHaveBeenCalled();
  });

  test("Signs in successfully with email and password", async () => {
    const authResult = {
      token: "token123",
      user: {
        id: "user1",
        email: "user@example.com",
        displayName: "user",
      },
    };
    const req = {
      body: { email: " user@example.com ", password: "password123" },
    };
    const res = createMockRes();

    authService.loginLocalUser.mockResolvedValue(authResult);

    await login(req, res);

    expect(authService.loginLocalUser).toHaveBeenCalledWith({
      email: " user@example.com ",
      password: "password123",
    });
    expect(res.json).toHaveBeenCalledWith(authResult);
    expect(res.status).not.toHaveBeenCalled();
  });

  test("Returns 401 if credentials are invalid", async () => {
    const req = {
      body: { email: "user@example.com", password: "wrong-password" },
    };
    const res = createMockRes();

    authService.loginLocalUser.mockRejectedValue(
      new Error("Invalid email or password."),
    );

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid email or password.",
    });
  });

  test("Returns 401 if account uses Google sign-in", async () => {
    const req = {
      body: { email: "user@example.com", password: "password123" },
    };
    const res = createMockRes();

    authService.loginLocalUser.mockRejectedValue(
      new Error("This account uses Google sign-in."),
    );

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "This account uses Google sign-in.",
    });
  });

  test("Returns 500 if sign in fails unexpectedly", async () => {
    const req = {
      body: { email: "user@example.com", password: "password123" },
    };
    const res = createMockRes();

    authService.loginLocalUser.mockRejectedValue(new Error("Database unavailable."));

    await login(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Database unavailable.",
    });
  });
});

describe("authController.register", () => {
  test("Returns 400 if email is missing", async () => {
    const req = {
      body: { password: "password123" },
    };
    const res = createMockRes();

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Email and password are required.",
    });
    expect(authService.registerLocalUser).not.toHaveBeenCalled();
  });

  test("Returns 400 if password is shorter than 8 characters", async () => {
    const req = {
      body: { email: "user@example.com", password: "short" },
    };
    const res = createMockRes();

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Password must be at least 8 characters long.",
    });
    expect(authService.registerLocalUser).not.toHaveBeenCalled();
  });

  test("Registers a new local account successfully", async () => {
    const authResult = {
      token: "register-token",
      user: {
        id: "user1",
        email: "user@example.com",
        displayName: "user",
      },
    };
    const req = {
      body: { email: "user@example.com", password: "password123" },
    };
    const res = createMockRes();

    authService.registerLocalUser.mockResolvedValue(authResult);

    await register(req, res);

    expect(authService.registerLocalUser).toHaveBeenCalledWith({
      email: "user@example.com",
      password: "password123",
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(authResult);
  });

  test("Returns 409 if email is already registered", async () => {
    const req = {
      body: { email: "user@example.com", password: "password123" },
    };
    const res = createMockRes();

    authService.registerLocalUser.mockRejectedValue(
      new Error("An account with this email already exists."),
    );

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: "An account with this email already exists.",
    });
  });

  test("Returns 409 if email is already linked to Google sign-in", async () => {
    const req = {
      body: { email: "user@example.com", password: "password123" },
    };
    const res = createMockRes();

    authService.registerLocalUser.mockRejectedValue(
      new Error("This email is already linked to Google sign-in."),
    );

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      message: "This email is already linked to Google sign-in.",
    });
  });

  test("Returns 500 if registration fails unexpectedly", async () => {
    const req = {
      body: { email: "user@example.com", password: "password123" },
    };
    const res = createMockRes();

    authService.registerLocalUser.mockRejectedValue(new Error("Database unavailable."));

    await register(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Database unavailable.",
    });
  });
});

describe("authController.googleLogin", () => {
  test("Returns 400 if Google credential is missing", async () => {
    const req = {
      body: {},
    };
    const res = createMockRes();

    await googleLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Google credential is required.",
    });
    expect(authService.loginWithGoogle).not.toHaveBeenCalled();
  });

  test("Signs in successfully with a Google credential", async () => {
    const authResult = {
      token: "google-token",
      user: {
        id: "google-user",
        email: "google@example.com",
        displayName: "Google User",
      },
    };
    const req = {
      body: { credential: "google-credential" },
    };
    const res = createMockRes();

    authService.loginWithGoogle.mockResolvedValue(authResult);

    await googleLogin(req, res);

    expect(authService.loginWithGoogle).toHaveBeenCalledWith("google-credential");
    expect(res.json).toHaveBeenCalledWith(authResult);
    expect(res.status).not.toHaveBeenCalled();
  });

  test("Returns 503 if Google sign-in is not configured", async () => {
    const req = {
      body: { credential: "google-credential" },
    };
    const res = createMockRes();

    authService.loginWithGoogle.mockRejectedValue(
      new Error("Google sign-in is not configured."),
    );

    await googleLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      message: "Google sign-in is not configured.",
    });
  });

  test("Returns 401 if Google account email is not verified", async () => {
    const req = {
      body: { credential: "google-credential" },
    };
    const res = createMockRes();

    authService.loginWithGoogle.mockRejectedValue(
      new Error("Google account email is not verified."),
    );

    await googleLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "Google account email is not verified.",
    });
  });

  test("Returns 401 if Google credential is invalid", async () => {
    const req = {
      body: { credential: "google-credential" },
    };
    const res = createMockRes();

    authService.loginWithGoogle.mockRejectedValue(
      new Error("Invalid Google credential."),
    );

    await googleLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      message: "Invalid Google credential.",
    });
  });

  test("Returns 500 if Google sign-in fails unexpectedly", async () => {
    const req = {
      body: { credential: "google-credential" },
    };
    const res = createMockRes();

    authService.loginWithGoogle.mockRejectedValue(new Error("Google service failed."));

    await googleLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Google service failed.",
    });
  });
});

describe("authController.guestLogin", () => {
  test("Creates a guest account successfully", async () => {
    const authResult = {
      token: "guest-token",
      user: {
        id: "guest1",
        email: "guest@example.com",
        displayName: "Guest ABC123",
        isGuest: true,
      },
    };
    const req = {};
    const res = createMockRes();

    authService.createGuestUser.mockResolvedValue(authResult);

    await guestLogin(req, res);

    expect(authService.createGuestUser).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(authResult);
  });

  test("Returns 500 if guest sign-in fails", async () => {
    const req = {};
    const res = createMockRes();

    authService.createGuestUser.mockRejectedValue(new Error("Guest creation failed."));

    await guestLogin(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Guest creation failed.",
    });
  });
});

describe("authController.me", () => {
  test("Returns the current authenticated user", async () => {
    const user = {
      id: "user1",
      email: "user@example.com",
      displayName: "User",
    };
    const req = {
      userId: "user1",
    };
    const res = createMockRes();

    authService.getUserById.mockResolvedValue(user);

    await me(req, res);

    expect(authService.getUserById).toHaveBeenCalledWith("user1");
    expect(res.json).toHaveBeenCalledWith({ user });
  });

  test("Returns 404 if current user cannot be found", async () => {
    const req = {
      userId: "missing-user",
    };
    const res = createMockRes();

    authService.getUserById.mockResolvedValue(null);

    await me(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "User not found.",
    });
  });

  test("Returns 500 if fetching current user fails", async () => {
    const req = {
      userId: "user1",
    };
    const res = createMockRes();

    authService.getUserById.mockRejectedValue(new Error("User lookup failed."));

    await me(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "User lookup failed.",
    });
  });
});
