const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildQuestionLookup,
  parseParticipantPreferences,
  participantHasUsablePreferences,
} = require("../src/services/preferenceParserService");

test("parseParticipantPreferences normalizes current recommendation answers and note hints", () => {
  const questionLookup = buildQuestionLookup([
    {
      category: "cuisine",
      questionList: [{ questionId: "q_cuisine_1", questionType: "multiple_choice" }],
    },
    {
      category: "budget",
      questionList: [{ questionId: "q_budget_1", questionType: "single_choice" }],
    },
    {
      category: "dietary",
      questionList: [{ questionId: "q_dietary_1", questionType: "multiple_choice" }],
    },
    {
      category: "special_request",
      questionList: [{ questionId: "q_note_1", questionType: "text" }],
    },
    {
      category: "location",
      questionList: [{ questionId: "lat_lng", questionType: "text" }],
    },
    {
      category: "distance",
      questionList: [{ questionId: "max_distance_km", questionType: "text" }],
    },
  ]);

  const [participant] = parseParticipantPreferences(
    [
      { userId: "user-1", questionId: "q_cuisine_1", answer: "Japanese, Cafe" },
      { userId: "user-1", questionId: "q_budget_1", answer: "Medium ($$)" },
      {
        userId: "user-1",
        questionId: "q_dietary_1",
        answer: "Vegetarian, No restrictions, Halal",
      },
      {
        userId: "user-1",
        questionId: "q_note_1",
        answer: "No seafood, quiet place, dessert would be nice, coffee, takeaway",
      },
      { userId: "user-1", questionId: "lat_lng", answer: "-36.8485, 174.7633" },
      { userId: "user-1", questionId: "max_distance_km", answer: "8 km" },
    ],
    questionLookup
  );

  assert.deepEqual(participant.cuisines, ["japanese", "cafe"]);
  assert.deepEqual(participant.dietary, ["vegetarian", "halal"]);
  assert.deepEqual(participant.exclude, ["seafood"]);
  assert.equal(participant.preferredPrice, "$$");
  assert.equal(participant.coffeePreference, "yes");
  assert.equal(participant.serviceMode, "takeaway");
  assert.equal(participant.openLatePreference, "");
  assert.deepEqual(participant.specialRequestKeywords, [
    "coffee",
    "takeaway",
    "dessert",
    "quiet",
  ]);
  assert.equal(participant.latitude, -36.8485);
  assert.equal(participant.longitude, 174.7633);
  assert.equal(participant.maxDistanceKm, 8);
  assert.equal(participantHasUsablePreferences(participant), true);
});

