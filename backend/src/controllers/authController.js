const {
  createGuestUser,
  getUserById,
  loginLocalUser,
  loginWithGoogle,
  registerLocalUser,
} = require("../services/authService");

function getMessage(error, fallback) {
  return error instanceof Error ? error.message : fallback;
}

async function register(req, res) {
  try {
    const { email, password } = req.body;

    if (!email?.trim() || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters long." });
    }

    const authResult = await registerLocalUser({ email, password });
    return res.status(201).json(authResult);
  } catch (error) {
    const message = getMessage(error, "Registration failed.");
    const statusCode = message.includes("already") || message.includes("linked") ? 409 : 500;
    return res.status(statusCode).json({ message });
  }
}

async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email?.trim() || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const authResult = await loginLocalUser({ email, password });
    return res.json(authResult);
  } catch (error) {
    const message = getMessage(error, "Login failed.");
    const statusCode =
      message.includes("Invalid") || message.includes("Google sign-in") ? 401 : 500;

    return res.status(statusCode).json({ message });
  }
}

async function googleLogin(req, res) {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ message: "Google credential is required." });
    }

    const authResult = await loginWithGoogle(credential);
    return res.json(authResult);
  } catch (error) {
    const message = getMessage(error, "Google sign-in failed.");
    const statusCode = message.includes("configured")
      ? 503
      : message.includes("not verified") || message.includes("Invalid")
        ? 401
        : 500;
    return res.status(statusCode).json({ message });
  }
}

async function guestLogin(req, res) {
  try {
    const authResult = await createGuestUser();
    return res.status(201).json(authResult);
  } catch (error) {
    const message = getMessage(error, "Guest sign-in failed.");
    return res.status(500).json({ message });
  }
}

async function me(req, res) {
  try {
    const user = await getUserById(req.userId);

    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    return res.json({ user });
  } catch (error) {
    const message = getMessage(error, "Failed to fetch user.");
    return res.status(500).json({ message });
  }
}

module.exports = {
  guestLogin,
  googleLogin,
  login,
  me,
  register,
};
