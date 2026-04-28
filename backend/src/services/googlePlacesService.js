const HttpError = require("../utils/httpError");
const { clampNumber } = require("../utils/geo");

const GOOGLE_PLACES_TEXT_SEARCH_URL =
  "https://places.googleapis.com/v1/places:searchText";
const GOOGLE_PLACES_FIELD_MASK = [
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
  "places.photos",
  "places.currentOpeningHours",
].join(",");
const GOOGLE_PLACE_PHOTO_MAX_WIDTH = 800;

const GOOGLE_PRICE_LEVEL_MAP = {
  $: ["PRICE_LEVEL_INEXPENSIVE"],
  $$: ["PRICE_LEVEL_MODERATE"],
  // The UI currently has only three budget buckets, so the top tier maps to both
  // expensive Google levels instead of forcing users to choose between them.
  $$$: ["PRICE_LEVEL_EXPENSIVE", "PRICE_LEVEL_VERY_EXPENSIVE"],
};

const QUERY_SAFE_DIETARY_TERMS = new Set([
  "vegetarian",
  "vegan",
  "halal",
  "gluten free",
  "gluten-free",
]);

const QUERY_SAFE_SPECIAL_REQUEST_TERMS = new Set([
  "dessert",
  "outdoor seating",
  "parking",
]);

function dedupePreserveOrder(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function mapPreferredPriceToGoogleLevels(preferredPrice) {
  return GOOGLE_PRICE_LEVEL_MAP[preferredPrice] || [];
}

function buildTextQuery(groupPrefs) {
  const dietaryTerms = (groupPrefs.dietary || [])
    .filter((value) => QUERY_SAFE_DIETARY_TERMS.has(value))
    .slice(0, 2);
  const cuisineTerms = (groupPrefs.topCuisines || []).slice(0, 2);
  const modifierTerms = [];

  if (groupPrefs.coffeePreference === "yes") {
    modifierTerms.push("coffee");
  }

  if (groupPrefs.openLatePreference === "yes") {
    modifierTerms.push("open late");
  }

  if (groupPrefs.serviceMode === "takeaway") {
    modifierTerms.push("takeaway");
  }

  const specialRequestTerms = (groupPrefs.specialRequestKeywords || [])
    .filter((value) => QUERY_SAFE_SPECIAL_REQUEST_TERMS.has(value))
    .slice(0, 2);

  const queryParts = dedupePreserveOrder([
    ...dietaryTerms,
    ...cuisineTerms,
    ...modifierTerms,
    ...specialRequestTerms,
    "restaurant",
  ]);

  return queryParts.join(" ").trim() || "restaurant";
}

function buildPlacesSearchPayload(groupPrefs) {
  // Keep the text query broad enough for discovery, then do stricter ranking locally.
  const payload = {
    textQuery: buildTextQuery(groupPrefs),
    includedType: "restaurant",
    strictTypeFiltering: true,
    pageSize: 20,
    languageCode: "en",
    regionCode: "NZ",
    locationBias: {
      circle: {
        center: {
          latitude: groupPrefs.latitude,
          longitude: groupPrefs.longitude,
        },
        radius: clampNumber((groupPrefs.maxDistanceKm || 5) * 1000, 100, 50000),
      },
    },
  };

  const googlePriceLevels = mapPreferredPriceToGoogleLevels(groupPrefs.preferredPrice);

  if (googlePriceLevels.length > 0) {
    payload.priceLevels = googlePriceLevels;
  }

  return payload;
}

async function searchGooglePlaces(groupPrefs) {
  if (!process.env.GOOGLE_PLACES_API_KEY) {
    throw new HttpError(500, "GOOGLE_PLACES_API_KEY is not configured.");
  }

  const response = await fetch(GOOGLE_PLACES_TEXT_SEARCH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": process.env.GOOGLE_PLACES_API_KEY,
      "X-Goog-FieldMask": GOOGLE_PLACES_FIELD_MASK,
    },
    body: JSON.stringify(buildPlacesSearchPayload(groupPrefs)),
  });

  const responseText = await response.text();
  let payload = {};

  try {
    payload = responseText ? JSON.parse(responseText) : {};
  } catch {
    payload = {};
  }

  if (!response.ok) {
    const upstreamMessage =
      payload.error?.message || "Google Places Text Search request failed.";
    throw new HttpError(502, upstreamMessage);
  }

  return Array.isArray(payload.places) ? payload.places : [];
}

async function fetchPlacePhotoUri(photoName) {
  if (!photoName || !process.env.GOOGLE_PLACES_API_KEY) {
    return "";
  }

  const encodedPhotoName = photoName
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const photoUrl =
    `https://places.googleapis.com/v1/${encodedPhotoName}/media` +
    `?key=${encodeURIComponent(process.env.GOOGLE_PLACES_API_KEY)}` +
    `&maxWidthPx=${GOOGLE_PLACE_PHOTO_MAX_WIDTH}` +
    "&skipHttpRedirect=true";

  try {
    const response = await fetch(photoUrl, {
      method: "GET",
    });

    const responseText = await response.text();
    let payload = {};

    try {
      payload = responseText ? JSON.parse(responseText) : {};
    } catch {
      payload = {};
    }

    if (!response.ok) {
      return "";
    }

    return typeof payload.photoUri === "string" ? payload.photoUri : "";
  } catch {
    return "";
  }
}

module.exports = {
  buildPlacesSearchPayload,
  buildTextQuery,
  fetchPlacePhotoUri,
  mapPreferredPriceToGoogleLevels,
  searchGooglePlaces,
};
