const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const GOOGLE_PLACES_URL = "https://places.googleapis.com/v1/places:searchText";
const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.rating",
  "places.userRatingCount",
  "places.priceLevel",
  "places.primaryType",
  "places.types",
  "places.googleMapsUri",
].join(",");

const DEFAULTS = {
  textQuery: "japanese restaurant auckland cbd",
  latitude: -36.8485,
  longitude: 174.7633,
  radiusMeters: 3000,
  pageSize: 5,
};

function printUsage() {
  console.log(`
Usage:
  node scripts/test-google-places-api.js
  node scripts/test-google-places-api.js "korean restaurant auckland"

Optional environment variables:
  TEST_PLACES_QUERY
  TEST_PLACES_LAT
  TEST_PLACES_LNG
  TEST_PLACES_RADIUS_METERS
  TEST_PLACES_PAGE_SIZE
`);
}

function readNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildRequestBody() {
  const cliQuery = process.argv.slice(2).join(" ").trim();
  const textQuery = cliQuery || process.env.TEST_PLACES_QUERY || DEFAULTS.textQuery;
  const latitude = readNumber(process.env.TEST_PLACES_LAT, DEFAULTS.latitude);
  const longitude = readNumber(process.env.TEST_PLACES_LNG, DEFAULTS.longitude);
  const radiusMeters = readNumber(
    process.env.TEST_PLACES_RADIUS_METERS,
    DEFAULTS.radiusMeters
  );
  const pageSize = Math.min(
    Math.max(readNumber(process.env.TEST_PLACES_PAGE_SIZE, DEFAULTS.pageSize), 1),
    20
  );

  return {
    textQuery,
    includedType: "restaurant",
    strictTypeFiltering: true,
    pageSize,
    languageCode: "en",
    regionCode: "NZ",
    locationBias: {
      circle: {
        center: {
          latitude,
          longitude,
        },
        radius: radiusMeters,
      },
    },
  };
}

async function main() {
  if (process.argv.includes("--help") || process.argv.includes("-h")) {
    printUsage();
    return;
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;

  if (!apiKey) {
    console.error("Missing GOOGLE_PLACES_API_KEY in backend/.env");
    process.exitCode = 1;
    return;
  }

  const requestBody = buildRequestBody();

  console.log("Testing Google Places Text Search with:");
  console.log(JSON.stringify(requestBody, null, 2));
  console.log("");

  let response;

  try {
    response = await fetch(GOOGLE_PLACES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": FIELD_MASK,
      },
      body: JSON.stringify(requestBody),
    });
  } catch (error) {
    console.error("Network error while calling Google Places:");
    console.error(error.message);
    process.exitCode = 1;
    return;
  }

  const rawBody = await response.text();
  let parsedBody = {};

  try {
    parsedBody = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    parsedBody = { rawBody };
  }

  if (!response.ok) {
    console.error(`Google Places request failed: ${response.status} ${response.statusText}`);
    console.error(JSON.stringify(parsedBody, null, 2));
    process.exitCode = 1;
    return;
  }

  const places = Array.isArray(parsedBody.places) ? parsedBody.places : [];

  console.log("Google Places API key works.");
  console.log(`Returned ${places.length} place(s).`);
  console.log("");

  if (places.length === 0) {
    console.log("No places were returned for this query.");
    return;
  }

  places.forEach((place, index) => {
    const name =
      typeof place.displayName?.text === "string"
        ? place.displayName.text
        : place.displayName || "Unknown";
    const address = place.formattedAddress || "No address";
    const rating = Number.isFinite(place.rating) ? place.rating : "n/a";
    const reviews = Number.isFinite(place.userRatingCount)
      ? place.userRatingCount
      : "n/a";

    console.log(
      `${index + 1}. ${name} | ${address} | rating: ${rating} | reviews: ${reviews}`
    );
  });
}

main().catch((error) => {
  console.error("Unexpected error:");
  console.error(error);
  process.exitCode = 1;
});
