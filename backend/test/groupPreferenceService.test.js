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

  expect(groupPrefs.topCuisines).toEqual(["japanese", "thai", "cafe"]);
  expect(groupPrefs.preferredPrice).toBe("$$");
  expect(groupPrefs.dietary).toEqual(["vegetarian", "halal"]);
  expect(groupPrefs.exclude).toEqual(["seafood", "nuts"]);
  expect(groupPrefs.coffeePreference).toBe("maybe");
  expect(groupPrefs.openLatePreference).toBe("yes");
  expect(groupPrefs.serviceMode).toBe("either");
  expect(groupPrefs.specialRequestKeywords).toEqual(["dessert", "parking", "quiet"]);
  expect(groupPrefs.maxDistanceKm).toBe(6);
  expect(groupPrefs.latitude).toBe(-36.8485);
  expect(groupPrefs.longitude).toBe(174.7633);
});
