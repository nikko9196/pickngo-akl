const request = require("supertest");

const BASE_URL = "http://localhost:5001";

async function registerTestUser(displayName = "Integration Test Account") {
  const unique = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;

  const response = await request(BASE_URL)
    .post("/api/auth/register")
    .send({
      displayName,
      email: `integration_${unique}@example.com`,
      password: "@testing123",
    });

  expect(response.statusCode).toBeGreaterThanOrEqual(200);
  expect(response.statusCode).toBeLessThan(300);
  expect(response.body.token).toBeTruthy();

  return {
    token: response.body.token,
    user: response.body.user,
  };
}

module.exports = {
  BASE_URL,
  registerTestUser,
};
