const { calculateDistanceKm } = require("../utils/geo");

const GOOGLE_PRICE_LEVEL_TO_SYMBOL = {
  PRICE_LEVEL_INEXPENSIVE: "$",
  PRICE_LEVEL_MODERATE: "$$",
  PRICE_LEVEL_EXPENSIVE: "$$$",
  PRICE_LEVEL_VERY_EXPENSIVE: "$$$$",
};

function mapGooglePriceLevelToSymbol(priceLevelRaw) {
  return GOOGLE_PRICE_LEVEL_TO_SYMBOL[priceLevelRaw] || "";
}

function normalizePlace(place, groupLocation) {
  if (!place || typeof place !== "object") {
    return null;
  }

  const latitude = Number.isFinite(place.location?.latitude)
    ? place.location.latitude
    : null;
  const longitude = Number.isFinite(place.location?.longitude)
    ? place.location.longitude
    : null;

  return {
    restaurantId: place.id || "",
    name:
      typeof place.displayName?.text === "string"
        ? place.displayName.text
        : typeof place.displayName === "string"
          ? place.displayName
          : "",
    address: place.formattedAddress || "",
    rating: Number.isFinite(place.rating) ? place.rating : null,
    userRatingCount: Number.isFinite(place.userRatingCount) ? place.userRatingCount : 0,
    priceLevelRaw: place.priceLevel || "",
    priceLevel: mapGooglePriceLevelToSymbol(place.priceLevel || ""),
    primaryType: place.primaryType || "",
    types: Array.isArray(place.types) ? place.types : [],
    latitude,
    longitude,
    mapsUrl: place.googleMapsUri || "",
    distanceKm:
      latitude !== null && longitude !== null
        ? calculateDistanceKm(groupLocation, { latitude, longitude })
        : null,
  };
}

module.exports = {
  mapGooglePriceLevelToSymbol,
  normalizePlace,
};
