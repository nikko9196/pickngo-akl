const request = require("supertest");

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:5001";

function createUniqueEmail(prefix = "integration") {
  const unique = `${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  return `${prefix}_${unique}@example.com`;
}

async function registerTestUser(prefix = "integration") {
  const email = createUniqueEmail(prefix);

  const response = await request(BASE_URL)
    .post("/api/auth/register")
    .send({
      email,
      password: "password123",
    });

  expect(response.statusCode).toBe(201);
  expect(response.body.token).toBeTruthy();
  expect(response.body.user).toBeTruthy();

  return {
    email,
    password: "password123",
    token: response.body.token,
    user: response.body.user,
  };
}

async function createTestRoom(token, overrides = {}) {
  const response = await request(BASE_URL)
    .post("/api/sessions")
    .set("Authorization", `Bearer ${token}`)
    .send({
      roomDisplayName: "Host",
      maxParticipants: 4,
      maxSelectionsPerUser: 3,
      location: {
        source: "map",
        label: "Auckland CBD",
        lat: -36.8485,
        lng: 174.7633,
        radiusMeters: 3000,
      },
      ...overrides,
    });

  expect(response.statusCode).toBe(201);
  expect(response.body.session).toBeTruthy();

  return response.body.session;
}

module.exports = {
  BASE_URL,
  createTestRoom,
  createUniqueEmail,
  registerTestUser,
};
