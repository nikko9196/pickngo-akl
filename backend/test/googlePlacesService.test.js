const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildPlacesSearchPayload,
  buildTextQuery,
  mapPreferredPriceToGoogleLevels,
} = require("../src/services/googlePlacesService");

test("buildTextQuery keeps only query-safe recommendation terms", () => {
  const query = buildTextQuery({
    dietary: ["vegetarian", "nut free", "halal"],
    topCuisines: ["japanese", "cafe"],
    coffeePreference: "yes",
    openLatePreference: "yes",
    serviceMode: "takeaway",
    specialRequestKeywords: ["dessert", "quiet", "parking"],
  });

  assert.equal(
    query,
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

  assert.equal(payload.includedType, "restaurant");
  assert.equal(payload.strictTypeFiltering, true);
  assert.equal(payload.pageSize, 20);
  assert.equal(payload.regionCode, "NZ");
  assert.equal(payload.languageCode, "en");
  assert.equal(payload.locationBias.circle.center.latitude, -36.8485);
  assert.equal(payload.locationBias.circle.center.longitude, 174.7633);
  assert.equal(payload.locationBias.circle.radius, 5000);
  assert.deepEqual(payload.priceLevels, [
    "PRICE_LEVEL_EXPENSIVE",
    "PRICE_LEVEL_VERY_EXPENSIVE",
  ]);
  assert.equal(
    payload.textQuery,
    "vegetarian halal japanese cafe coffee open late takeaway dessert parking restaurant"
  );
  assert.deepEqual(mapPreferredPriceToGoogleLevels("$$$"), [
    "PRICE_LEVEL_EXPENSIVE",
    "PRICE_LEVEL_VERY_EXPENSIVE",
  ]);
});

