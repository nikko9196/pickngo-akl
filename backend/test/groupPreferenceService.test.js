const test = require("node:test");
const assert = require("node:assert/strict");

const { combineGroupPreferences } = require("../src/services/groupPreferenceService");

test("combineGroupPreferences builds stable group preferences from participant answers", () => {
  const groupPrefs = combineGroupPreferences([
    {
      cuisines: ["japanese", "cafe"],
      dietary: ["vegetarian"],
      exclude: ["seafood"],
      preferredPrice: "$$",
      coffeePreference: "yes",
      openLatePreference: "yes",
      serviceMode: "takeaway",
      specialRequestKeywords: ["dessert"],
      latitude: -36.8485,
      longitude: 174.7633,
      maxDistanceKm: 5,
    },
    {
      cuisines: ["japanese", "thai"],
      dietary: ["halal"],
      exclude: [],
      preferredPrice: "$$",
      coffeePreference: "maybe",
      openLatePreference: "no",
      serviceMode: "either",
      specialRequestKeywords: ["parking"],
      latitude: -36.8585,
      longitude: 174.7533,
      maxDistanceKm: 7,
    },
    {
      cuisines: ["thai", "indian"],
      dietary: [],
      exclude: ["nuts"],
      preferredPrice: "$",
      coffeePreference: "no",
      openLatePreference: "yes",
      serviceMode: "dine_in",
      specialRequestKeywords: ["dessert", "quiet"],
      latitude: -36.8385,
      longitude: 174.7733,
      maxDistanceKm: 6,
    },
  ]);

  assert.deepEqual(groupPrefs.topCuisines, ["japanese", "thai", "cafe"]);
  assert.equal(groupPrefs.preferredPrice, "$$");
  assert.deepEqual(groupPrefs.dietary, ["vegetarian", "halal"]);
  assert.deepEqual(groupPrefs.exclude, ["seafood", "nuts"]);
  assert.equal(groupPrefs.coffeePreference, "maybe");
  assert.equal(groupPrefs.openLatePreference, "yes");
  assert.equal(groupPrefs.serviceMode, "either");
  assert.deepEqual(groupPrefs.specialRequestKeywords, ["dessert", "parking", "quiet"]);
  assert.equal(groupPrefs.maxDistanceKm, 6);
  assert.equal(groupPrefs.latitude, -36.8485);
  assert.equal(groupPrefs.longitude, 174.7633);
});

