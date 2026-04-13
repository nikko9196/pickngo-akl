const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");

const User = require("../models/User");

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const TOKEN_EXPIRES_IN = "7d";

const googleClient = GOOGLE_CLIENT_ID
  ? new OAuth2Client(GOOGLE_CLIENT_ID)
  : null;

function sanitizeUser(user) {
  return {
    id: user._id.toString(),
    displayName: user.displayName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    authProviders: user.authProviders.map(({ provider }) => provider),
    isGuest: user.authProviders.some(({ provider }) => provider === "guest"),
    isAdmin: user.isAdmin,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

function createToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      email: user.email,
    },
    JWT_SECRET,
    { expiresIn: TOKEN_EXPIRES_IN }
  );
}

function getProvider(user, provider) {
  return user.authProviders.find((entry) => entry.provider === provider);
}

async function registerLocalUser({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  const existingUser = await User.findOne({ email: normalizedEmail });

  if (existingUser) {
    const hasLocalAccount = Boolean(getProvider(existingUser, "local"));

    if (hasLocalAccount) {
      throw new Error("An account with this email already exists.");
    }

    throw new Error("This email is already linked to Google sign-in.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const now = new Date();
  const derivedDisplayName = normalizedEmail.split("@")[0];

  const user = await User.create({
    displayName: derivedDisplayName,
    email: normalizedEmail,
    authProviders: [
      {
        provider: "local",
        passwordHash,
      },
    ],
    lastLoginAt: now,
  });

  return {
    token: createToken(user),
    user: sanitizeUser(user),
  };
}

async function createGuestUser() {
  const now = new Date();
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  const guestId = `guest-${Date.now()}-${suffix.toLowerCase()}`;

  const user = await User.create({
    displayName: `Guest ${suffix}`,
    email: `${guestId}@guest.haveabyte.local`,
    authProviders: [
      {
        provider: "guest",
        providerUserId: guestId,
      },
    ],
    lastLoginAt: now,
  });

  return {
    token: createToken(user),
    user: sanitizeUser(user),
  };
}

async function loginLocalUser({ email, password }) {
  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    throw new Error("Invalid email or password.");
  }

  const localProvider = getProvider(user, "local");

  if (!localProvider?.passwordHash) {
    throw new Error("This account uses Google sign-in.");
  }

  const isValidPassword = await bcrypt.compare(password, localProvider.passwordHash);

  if (!isValidPassword) {
    throw new Error("Invalid email or password.");
  }

  user.lastLoginAt = new Date();
  await user.save();

  return {
    token: createToken(user),
    user: sanitizeUser(user),
  };
}

async function loginWithGoogle(googleCredential) {
  if (!googleClient || !GOOGLE_CLIENT_ID) {
    throw new Error("Google sign-in is not configured.");
  }

  const ticket = await googleClient.verifyIdToken({
    idToken: googleCredential,
    audience: GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  if (!payload?.email || !payload.email_verified) {
    throw new Error("Google account email is not verified.");
  }

  const normalizedEmail = payload.email.toLowerCase();
  let user = await User.findOne({ email: normalizedEmail });
  const googleSubject = payload.sub;

  if (!user) {
    user = await User.create({
      displayName: payload.name || normalizedEmail.split("@")[0],
      email: normalizedEmail,
      avatarUrl: payload.picture || "",
      authProviders: [
        {
          provider: "google",
          providerUserId: googleSubject,
        },
      ],
      lastLoginAt: new Date(),
    });
  } else {
    const googleProvider = getProvider(user, "google");

    if (!googleProvider) {
      user.authProviders.push({
        provider: "google",
        providerUserId: googleSubject,
      });
    } else if (!googleProvider.providerUserId) {
      googleProvider.providerUserId = googleSubject;
    }

    if (!user.avatarUrl && payload.picture) {
      user.avatarUrl = payload.picture;
    }

    if (payload.name && !user.displayName) {
      user.displayName = payload.name;
    }

    user.lastLoginAt = new Date();
    await user.save();
  }

  return {
    token: createToken(user),
    user: sanitizeUser(user),
  };
}

async function getUserById(userId) {
  const user = await User.findById(userId);
  return user ? sanitizeUser(user) : null;
}

module.exports = {
  createGuestUser,
  createToken,
  getUserById,
  loginLocalUser,
  loginWithGoogle,
  registerLocalUser,
  sanitizeUser,
  JWT_SECRET,
};
