const { createSession } = require("../../../controllers/sessionController");
const Session = require("../../../models/Session");

jest.mock("../../../models/Session");
jest.mock("../../../models/Response");
jest.mock("../../../models/QuestionList");

function createMockRes() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  };
}

function createMockSession(overrides = {}) {
  const sessionObject = {
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
      label: "Auckland CBD",
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
        joinedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ],
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };

  return {
    _id: sessionObject._id,
    toObject: jest.fn(() => sessionObject),
  };
}

function mockFindById(session) {
  Session.findById.mockReturnValue({
    populate: jest.fn().mockResolvedValue(session),
  });
}

function createValidReq(overrides = {}) {
  return {
    userId: "host1",
    body: {
      maxParticipants: 4,
      maxSelectionsPerUser: 3,
      roomDisplayName: "Host",
      location: {
        source: "map",
        label: "Auckland CBD",
        lat: -36.8485,
        lng: 174.7633,
        radiusMeters: 3000,
      },
      ...overrides,
    },
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  Session.exists.mockResolvedValue(false);
});

describe("sessionController.createSession", () => {
  test("Returns 400 if maxParticipants is invalid", async () => {
    const req = createValidReq({ maxParticipants: 1 });
    const res = createMockRes();

    await createSession(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Max participants must be an integer between 2 and 50.",
    });
    expect(Session.create).not.toHaveBeenCalled();
  });

  test("Returns 400 if maxParticipants is greater than 50", async () => {
    const req = createValidReq({ maxParticipants: 51 });
    const res = createMockRes();

    await createSession(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Max participants must be an integer between 2 and 50.",
    });
    expect(Session.create).not.toHaveBeenCalled();
  });

  test("Returns 400 if maxParticipants is a decimal number", async () => {
    const req = createValidReq({ maxParticipants: 4.5 });
    const res = createMockRes();

    await createSession(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Max participants must be an integer between 2 and 50.",
    });
    expect(Session.create).not.toHaveBeenCalled();
  });

  test("Returns 400 if maxParticipants is a non-numeric string", async () => {
    const req = createValidReq({ maxParticipants: "four" });
    const res = createMockRes();

    await createSession(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Max participants must be an integer between 2 and 50.",
    });
    expect(Session.create).not.toHaveBeenCalled();
  });

  test("Returns 400 if room display name is missing", async () => {
    const req = createValidReq({ roomDisplayName: "   " });
    const res = createMockRes();

    await createSession(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Room display name is required and must be 30 characters or fewer.",
    });
    expect(Session.create).not.toHaveBeenCalled();
  });

  test("Returns 400 if room display name is longer than 30 characters", async () => {
    const req = createValidReq({
      roomDisplayName: "A room display name over thirty characters",
    });
    const res = createMockRes();

    await createSession(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Room display name is required and must be 30 characters or fewer.",
    });
    expect(Session.create).not.toHaveBeenCalled();
  });

  test("Returns 400 if maxSelectionsPerUser is invalid", async () => {
    const req = createValidReq({ maxSelectionsPerUser: 11 });
    const res = createMockRes();

    await createSession(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Max selections per user must be an integer between 1 and 10.",
    });
    expect(Session.create).not.toHaveBeenCalled();
  });

  test("Returns 400 if location is invalid", async () => {
    const req = createValidReq({
      location: {
        source: "map",
        lat: -91,
        lng: 174.7633,
        radiusMeters: 3000,
      },
    });
    const res = createMockRes();

    await createSession(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message:
        "Location must include a valid source, latitude, longitude, and radius between 100 and 50000 meters.",
    });
    expect(Session.create).not.toHaveBeenCalled();
  });

  test("Returns 400 if location source is invalid", async () => {
    const req = createValidReq({
      location: {
        source: "gps",
        lat: -36.8485,
        lng: 174.7633,
        radiusMeters: 3000,
      },
    });
    const res = createMockRes();

    await createSession(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message:
        "Location must include a valid source, latitude, longitude, and radius between 100 and 50000 meters.",
    });
    expect(Session.create).not.toHaveBeenCalled();
  });

  test("Returns 400 if location longitude is invalid", async () => {
    const req = createValidReq({
      location: {
        source: "map",
        lat: -36.8485,
        lng: 181,
        radiusMeters: 3000,
      },
    });
    const res = createMockRes();

    await createSession(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message:
        "Location must include a valid source, latitude, longitude, and radius between 100 and 50000 meters.",
    });
    expect(Session.create).not.toHaveBeenCalled();
  });

  test("Returns 400 if location radius is outside the allowed range", async () => {
    const req = createValidReq({
      location: {
        source: "map",
        lat: -36.8485,
        lng: 174.7633,
        radiusMeters: 50,
      },
    });
    const res = createMockRes();

    await createSession(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message:
        "Location must include a valid source, latitude, longitude, and radius between 100 and 50000 meters.",
    });
    expect(Session.create).not.toHaveBeenCalled();
  });

  test("Returns 400 if location radius is greater than 50000", async () => {
    const req = createValidReq({
      location: {
        source: "map",
        lat: -36.8485,
        lng: 174.7633,
        radiusMeters: 50001,
      },
    });
    const res = createMockRes();

    await createSession(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message:
        "Location must include a valid source, latitude, longitude, and radius between 100 and 50000 meters.",
    });
    expect(Session.create).not.toHaveBeenCalled();
  });

  test("Creates room successfully and adds current user as host", async () => {
    const req = createValidReq();
    const res = createMockRes();
    const createdSession = {
      _id: {
        toString: () => "session123",
      },
    };
    const populatedSession = createMockSession();

    Session.create.mockResolvedValue(createdSession);
    mockFindById(populatedSession);

    await createSession(req, res);

    expect(Session.exists).toHaveBeenCalledWith(expect.objectContaining({
      sessionCode: expect.any(String),
    }));
    expect(Session.create).toHaveBeenCalledWith(
      expect.objectContaining({
        hostUserId: "host1",
        maxParticipants: 4,
        maxSelectionsPerUser: 3,
        location: {
          source: "map",
          label: "Auckland CBD",
          lat: -36.8485,
          lng: 174.7633,
          radiusMeters: 3000,
        },
        participants: [
          {
            userId: "host1",
            role: "host",
            roomDisplayName: "Host",
          },
        ],
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      session: expect.objectContaining({
        id: "session123",
        hostUserId: "host1",
        currentUserRole: "host",
        currentUserRoomDisplayName: "Host",
        participantCount: 1,
      }),
    });
  });

  test("Uses default max selections per user when it is not provided", async () => {
    const req = createValidReq();
    const res = createMockRes();
    const createdSession = {
      _id: {
        toString: () => "session123",
      },
    };
    const populatedSession = createMockSession();

    delete req.body.maxSelectionsPerUser;
    Session.create.mockResolvedValue(createdSession);
    mockFindById(populatedSession);

    await createSession(req, res);

    expect(Session.create).toHaveBeenCalledWith(
      expect.objectContaining({
        maxSelectionsPerUser: 3,
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("Allows creating room without location and serializes lat/lng as null", async () => {
    const req = createValidReq();
    const res = createMockRes();
    const createdSession = {
      _id: {
        toString: () => "session123",
      },
    };
    const populatedSession = createMockSession({
      location: {},
    });

    delete req.body.location;
    Session.create.mockResolvedValue(createdSession);
    mockFindById(populatedSession);

    await createSession(req, res);

    expect(Session.create).toHaveBeenCalledWith(
      expect.objectContaining({
        location: {},
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      session: expect.objectContaining({
        location: {
          source: "map",
          label: "",
          lat: null,
          lng: null,
          radiusMeters: 3000,
        },
      }),
    });
  });

  test("Creates room successfully with current location source", async () => {
    const req = createValidReq({
      location: {
        source: "current",
        label: "Current location",
        lat: -36.8485,
        lng: 174.7633,
        radiusMeters: 1000,
      },
    });
    const res = createMockRes();
    const createdSession = {
      _id: {
        toString: () => "session123",
      },
    };
    const populatedSession = createMockSession({
      location: {
        source: "current",
        label: "Current location",
        lat: -36.8485,
        lng: 174.7633,
        radiusMeters: 1000,
      },
    });

    Session.create.mockResolvedValue(createdSession);
    mockFindById(populatedSession);

    await createSession(req, res);

    expect(Session.create).toHaveBeenCalledWith(
      expect.objectContaining({
        location: {
          source: "current",
          label: "Current location",
          lat: -36.8485,
          lng: 174.7633,
          radiusMeters: 1000,
        },
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      session: expect.objectContaining({
        location: {
          source: "current",
          label: "Current location",
          lat: -36.8485,
          lng: 174.7633,
          radiusMeters: 1000,
        },
      }),
    });
  });

  test("Retries session code generation when the first code already exists", async () => {
    const req = createValidReq();
    const res = createMockRes();
    const createdSession = {
      _id: {
        toString: () => "session123",
      },
    };
    const populatedSession = createMockSession();

    Session.exists
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    Session.create.mockResolvedValue(createdSession);
    mockFindById(populatedSession);

    await createSession(req, res);

    expect(Session.exists).toHaveBeenCalledTimes(2);
    expect(Session.create).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test("Returns 500 if a unique session code cannot be generated", async () => {
    const req = createValidReq();
    const res = createMockRes();

    Session.exists.mockResolvedValue(true);

    await createSession(req, res);

    expect(Session.exists).toHaveBeenCalledTimes(10);
    expect(Session.create).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Unable to generate a unique session code.",
    });
  });

  test("Returns 500 if room creation fails", async () => {
    const req = createValidReq();
    const res = createMockRes();

    Session.create.mockRejectedValue(new Error("Failed to insert session."));

    await createSession(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Failed to insert session.",
    });
  });
});
