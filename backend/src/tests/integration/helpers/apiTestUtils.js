const express = require("express");
const jwt = require("jsonwebtoken");

const authRoutes = require("../../../routes/authRoutes");
const questionRoutes = require("../../../routes/questionRoutes");
const sessionRoutes = require("../../../routes/sessionRoutes");
const authService = require("../../../services/authService");
const QuestionList = require("../../../models/QuestionList");
const Session = require("../../../models/Session");

function createTestApp() {
  const app = express();

  app.use(express.json());
  app.use("/api/auth", authRoutes);
  app.use("/api/questions", questionRoutes);
  app.use("/api/sessions", sessionRoutes);

  return app;
}

function createToken(userId = "user1") {
  return jwt.sign(
    {
      sub: userId,
      email: `${userId}@example.com`,
    },
    authService.JWT_SECRET,
  );
}

function createSessionObject(overrides = {}) {
  return {
    _id: {
      toString: () => "session123",
    },
    hostUserId: {
      toString: () => "host1",
    },
    sessionCode: "ABC123",
    joinUrl: "http://localhost:5173/join/ABC123",
    status: "waiting",
    maxParticipants: 4,
    maxSelectionsPerUser: 3,
    location: {
      source: "map",
      label: "",
      lat: -36.8485,
      lng: 174.7633,
      radiusMeters: 3000,
    },
    participants: [
      {
        userId: {
          toString: () => "host1",
        },
        role: "host",
        roomDisplayName: "Host",
      },
    ],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

function createMockSession(overrides = {}) {
  const sessionObject = createSessionObject(overrides);
  const session = {
    ...sessionObject,
    deleteOne: jest.fn().mockResolvedValue(true),
    save: jest.fn().mockResolvedValue(true),
  };

  session.toObject = jest.fn(() => ({
    ...sessionObject,
    status: session.status,
    maxParticipants: session.maxParticipants,
    maxSelectionsPerUser: session.maxSelectionsPerUser,
    participants: session.participants,
  }));

  return session;
}

function mockFindById(session) {
  Session.findById.mockReturnValue({
    populate: jest.fn().mockResolvedValue(session),
  });
}

function mockFindOne(session) {
  Session.findOne.mockReturnValue({
    populate: jest.fn().mockResolvedValue(session),
  });
}

function mockFind(sessions) {
  const populate = jest.fn().mockResolvedValue(sessions);
  const sort = jest.fn(() => ({ populate }));
  Session.find.mockReturnValue({ sort });
}

function mockFindByIdSelect(session) {
  Session.findById.mockReturnValue({
    select: jest.fn().mockResolvedValue(session),
  });
}

function mockSortedQuestionLists(result) {
  QuestionList.find.mockReturnValue({
    sort: jest.fn().mockResolvedValue(result),
  });
}

module.exports = {
  createMockSession,
  createTestApp,
  createToken,
  mockFind,
  mockFindById,
  mockFindByIdSelect,
  mockFindOne,
  mockSortedQuestionLists,
};
