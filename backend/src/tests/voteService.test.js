const { applyVote, calculateVoteResult } = require("../services/voteService");

function createMockSession(overrides = {}) {
  return {
    status: "voting",
    currentWheelResult: {
      recommendationSnapshotId: "snapshot1",
      placeId: "place1",
    },
    finalWheelResult: null,
    lastWheelResult: null,
    lastVoteSummary: null,
    wheelItems: [
      { placeId: "place1" },
      { placeId: "place2" },
      { placeId: "place3" },
    ],
    voteSummary: {
      acceptCount: 0,
      respinCount: 0,
      votedUserIds: [],
    },
    save: jest.fn().mockResolvedValue(true),
    ...overrides,
  };
}

// Test: applyVote for accept vote and respin vote counts, and duplicate vote rejection from the same user:
describe("voteService.applyVote", () => {
  test("Adds accept vote", async () => {
    const session = createMockSession();

    const result = await applyVote(session, "user1", "accept");

    expect(result.acceptCount).toBe(1);
    expect(result.respinCount).toBe(0);
    expect(result.votedUserIds).toContain("user1");
    expect(session.save).toHaveBeenCalled();
  });

  test("Adds respin vote", async () => {
    const session = createMockSession();

    const result = await applyVote(session, "user1", "respin");

    expect(result.acceptCount).toBe(0);
    expect(result.respinCount).toBe(1);
    expect(result.votedUserIds).toContain("user1");
    expect(session.save).toHaveBeenCalled();
  });

  test("Rejects duplicate vote from same user", async () => {
    const session = createMockSession({
      voteSummary: {
        acceptCount: 1,
        respinCount: 0,
        votedUserIds: ["user1"],
      },
    });

    await expect(applyVote(session, "user1", "respin")).rejects.toThrow(
      "You have already voted.",
    );
  });
});

// Test: calculateVoteResult
describe("voteService.calculateVoteResult", () => {
  test("Throws error when no current wheel result exists", async () => {
    const session = createMockSession({
      currentWheelResult: null,
    });

    await expect(calculateVoteResult(session)).rejects.toThrow(
      "No wheel result is available to vote on.",
    );
  });

  // Test: Accept wins:
  test("Accept wins and completes session", async () => {
    const session = createMockSession({
      voteSummary: {
        acceptCount: 2,
        respinCount: 1,
        votedUserIds: ["user1", "user2", "user3"],
      },
    });

    const result = await calculateVoteResult(session);

    expect(result.result).toBe("The wheel result is accepted.");

    // Check Database state:
    expect(session.finalWheelResult).toEqual(session.currentWheelResult);
    expect(session.status).toBe("completed");

    // Check Response:
    expect(result.finalWheelResult).toEqual(session.finalWheelResult);
    expect(result.voteSummary).toEqual(session.voteSummary);

    expect(session.save).toHaveBeenCalled();
  });

  // Test: Respin wins:
  // isNextSpinFinal: true:
  test("Respin wins (isNextSpinFinal: true) and rejects current result", async () => {
    const session = createMockSession({
      voteSummary: {
        acceptCount: 1,
        respinCount: 2,
        votedUserIds: ["user1", "user2", "user3"],
      },
    });

    const result = await calculateVoteResult(session);

    expect(result.result).toBe(
      "The result is rejected. Spinning the wheel again.",
    );

    // Check Database state:
    expect(session.wheelItems).toEqual([
      { placeId: "place2" },
      { placeId: "place3" },
    ]);
    expect(session.lastWheelResult.placeId).toBe("place1");
    expect(session.lastVoteSummary).toEqual({
      acceptCount: 1,
      respinCount: 2,
      votedUserIds: ["user1", "user2", "user3"],
    });
    expect(session.currentWheelResult).toBeNull();
    expect(session.status).toBe("spinning");

    // Check Response:
    expect(result.rejectedWheelResult.placeId).toBe("place1");
    expect(result.remainingUniquePlaceIds).toEqual(["place2", "place3"]);
    expect(result.voteSummary).toEqual(session.voteSummary);
    expect(result.isNextSpinFinal).toBe(true);

    expect(session.save).toHaveBeenCalled();
  });

  // isNextSpinFinal: false:
  test("Respin wins (isNextSpinFinal: false) and rejects current result", async () => {
    const session = createMockSession({
      wheelItems: [
        { placeId: "place1" },
        { placeId: "place2" },
        { placeId: "place3" },
        { placeId: "place4" },
      ],
      voteSummary: {
        acceptCount: 1,
        respinCount: 2,
        votedUserIds: ["user1", "user2", "user3"],
      },
    });

    const result = await calculateVoteResult(session);

    expect(result.result).toBe(
      "The result is rejected. Spinning the wheel again.",
    );

    // Check Database state:
    expect(session.wheelItems).toEqual([
      { placeId: "place2" },
      { placeId: "place3" },
      { placeId: "place4" },
    ]);
    expect(session.lastWheelResult.placeId).toBe("place1");
    expect(session.lastVoteSummary).toEqual({
      acceptCount: 1,
      respinCount: 2,
      votedUserIds: ["user1", "user2", "user3"],
    });
    expect(session.currentWheelResult).toBeNull();
    expect(session.status).toBe("spinning");

    // Check Response:
    expect(result.rejectedWheelResult.placeId).toBe("place1");
    expect(result.remainingUniquePlaceIds).toEqual([
      "place2",
      "place3",
      "place4",
    ]);
    expect(result.voteSummary).toEqual(session.voteSummary);
    expect(result.isNextSpinFinal).toBe(false);

    expect(session.save).toHaveBeenCalled();
  });

  // Test: Tie vote is treated as respin:
  test("Tie vote is treated as respin", async () => {
    const session = createMockSession({
      voteSummary: {
        acceptCount: 1,
        respinCount: 1,
        votedUserIds: ["user1", "user2"],
      },
    });

    const result = await calculateVoteResult(session);

    // Check Database state:
    expect(session.currentWheelResult).toBeNull();
    expect(session.lastWheelResult.placeId).toBe("place1");
    expect(session.lastVoteSummary).toEqual({
      acceptCount: 1,
      respinCount: 1,
      votedUserIds: ["user1", "user2"],
    });
    expect(session.status).toBe("spinning");
    expect(session.wheelItems).toEqual([
      { placeId: "place2" },
      { placeId: "place3" },
    ]);

    // Check Response:
    expect(result.result).toBe(
      "The result is rejected. Spinning the wheel again.",
    );
    expect(result.status).toBe("spinning");
    expect(result.voteSummary).toEqual(session.voteSummary);
    expect(result.isNextSpinFinal).toBe(true);

    expect(session.save).toHaveBeenCalled();
  });

  // Test: 2 unique remaining restaurants on the wheel = Final spin:
  test("Final spin completes session when only two unique restaurants remain", async () => {
    const session = createMockSession({
      wheelItems: [{ placeId: "place1" }, { placeId: "place2" }],
      voteSummary: {
        acceptCount: 0,
        respinCount: 1,
        votedUserIds: ["user1"],
      },
    });

    const result = await calculateVoteResult(session);

    // Check Database state:
    expect(session.finalWheelResult).toEqual(session.currentWheelResult);
    expect(session.status).toBe("completed");

    // Check Response:
    expect(result.result).toBe("Final spin result is selected.");
    expect(result.finalSpin).toBe(true);
    expect(result.finalWheelResult).toEqual(session.finalWheelResult);
    expect(result.voteSummary).toEqual(session.voteSummary);

    expect(session.save).toHaveBeenCalled();
  });
});
