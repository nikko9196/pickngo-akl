const {
  buildPlacesSearchPayload,
  buildTextQuery,
  mapPreferredPriceToGoogleLevels,
} = require("../../../services/googlePlacesService");

test("buildTextQuery keeps only query-safe recommendation terms", () => {
  const query = buildTextQuery({
    dietary: ["vegetarian", "nut free", "halal"],
    topCuisines: ["japanese", "cafe"],
    coffeePreference: "yes",
    openLatePreference: "yes",
    serviceMode: "takeaway",
    specialRequestKeywords: ["dessert", "quiet", "parking"],
  });

  expect(query).toBe(
    "vegetarian halal japanese cafe coffee open late takeaway dessert parking restaurant"
  );
});

test("buildPlacesSearchPayload matches the current Google Places contract", () => {
  const payload = buildPlacesSearchPayload({
    dietary: ["vegetarian", "halal"],
    topCuisines: ["japanese", "cafe"],
    coffeePreference: "yes",
    openLatePreference: "yes",
    serviceMode: "takeaway",
    specialRequestKeywords: ["dessert", "parking"],
    preferredPrice: "$$$",
    latitude: -36.8485,
    longitude: 174.7633,
    maxDistanceKm: 5,
  });

  expect(payload.includedType).toBe("restaurant");
  expect(payload.strictTypeFiltering).toBe(true);
  expect(payload.pageSize).toBe(20);
  expect(payload.regionCode).toBe("NZ");
  expect(payload.languageCode).toBe("en");
  expect(payload.locationBias.circle.center.latitude).toBe(-36.8485);
  expect(payload.locationBias.circle.center.longitude).toBe(174.7633);
  expect(payload.locationBias.circle.radius).toBe(5000);
  expect(payload.priceLevels).toEqual([
    "PRICE_LEVEL_EXPENSIVE",
    "PRICE_LEVEL_VERY_EXPENSIVE",
  ]);
  expect(payload.textQuery).toBe(
    "vegetarian halal japanese cafe coffee open late takeaway dessert parking restaurant"
  );
  expect(mapPreferredPriceToGoogleLevels("$$$")).toEqual([
    "PRICE_LEVEL_EXPENSIVE",
    "PRICE_LEVEL_VERY_EXPENSIVE",
  ]);
});
