const { fetchPlacePhotoUri } = require("./googlePlacesService");

const PRICE_LEVEL_NUMBER_MAP = {
  $: 1,
  $$: 2,
  $$$: 3,
  $$$$: 4,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

const RESTAURANT_LABEL_LIMIT = 3;
const GOOGLE_TYPE_TO_CUISINE_LABEL = Object.freeze({
  japanese_restaurant: "Japanese",
  sushi_restaurant: "Japanese",
  ramen_restaurant: "Japanese",
  korean_restaurant: "Korean",
  chinese_restaurant: "Chinese",
  dumpling_restaurant: "Chinese",
  thai_restaurant: "Thai",
  vietnamese_restaurant: "Vietnamese",
  pho_restaurant: "Vietnamese",
  indian_restaurant: "Indian",
  italian_restaurant: "Italian",
  pizza_restaurant: "Italian",
  mexican_restaurant: "Mexican",
  turkish_restaurant: "Turkish",
  kebab_shop: "Turkish",
  mediterranean_restaurant: "Mediterranean",
  greek_restaurant: "Mediterranean",
  american_restaurant: "American",
  hamburger_restaurant: "American",
  barbecue_restaurant: "American",
  steak_house: "American",
  fast_food_restaurant: "American",
  malaysian_restaurant: "Malaysian",
  middle_eastern_restaurant: "Middle Eastern",
  lebanese_restaurant: "Middle Eastern",
  seafood_restaurant: "Seafood",
  oyster_bar_restaurant: "Seafood",
});
const GOOGLE_TYPE_TO_VENUE_LABEL = Object.freeze({
  cafe: "Cafe",
  coffee_shop: "Cafe",
  espresso_bar: "Cafe",
  breakfast_restaurant: "Cafe",
  brunch_restaurant: "Cafe",
  dessert_restaurant: "Dessert",
  dessert_shop: "Dessert",
  ice_cream_shop: "Dessert",
  bakery: "Dessert",
  donut_shop: "Dessert",
  bar: "Bar",
  pub: "Bar",
});
const GOOGLE_GENERIC_FALLBACK_LABEL = Object.freeze({
  restaurant: "Restaurant",
});
const IGNORED_GOOGLE_TYPES = new Set([
  "food",
  "point_of_interest",
  "establishment",
  "meal_takeaway",
  "takeout_restaurant",
  "family_restaurant",
  "fine_dining_restaurant",
]);

function normalizeGoogleType(rawType) {
  if (typeof rawType !== "string") {
    return "";
  }

  return rawType.trim().toLowerCase();
}

function dedupePreserveOrder(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function collectOrderedGoogleTypes(restaurant) {
  return dedupePreserveOrder(
    [restaurant.primaryType, ...(restaurant.types || [])]
      .map(normalizeGoogleType)
      .filter((value) => value && !IGNORED_GOOGLE_TYPES.has(value))
  );
}

function deriveCuisineList(restaurant) {
  const sourceTypes = collectOrderedGoogleTypes(restaurant);
  const cuisineLabels = [];
  const venueLabels = [];
  let genericFallbackLabel = "";

  sourceTypes.forEach((googleType) => {
    const cuisineLabel = GOOGLE_TYPE_TO_CUISINE_LABEL[googleType];

    if (cuisineLabel && !cuisineLabels.includes(cuisineLabel)) {
      cuisineLabels.push(cuisineLabel);
      return;
    }

    const venueLabel = GOOGLE_TYPE_TO_VENUE_LABEL[googleType];

    if (venueLabel && !venueLabels.includes(venueLabel)) {
      venueLabels.push(venueLabel);
      return;
    }

    if (!genericFallbackLabel && GOOGLE_GENERIC_FALLBACK_LABEL[googleType]) {
      genericFallbackLabel = GOOGLE_GENERIC_FALLBACK_LABEL[googleType];
    }
  });

  if (cuisineLabels.length > 0) {
    return [...cuisineLabels, ...venueLabels].slice(0, RESTAURANT_LABEL_LIMIT);
  }

  if (venueLabels.length > 0) {
    return venueLabels.slice(0, RESTAURANT_LABEL_LIMIT);
  }

  return genericFallbackLabel ? [genericFallbackLabel] : [];
}

function extractDistrict(address) {
  if (typeof address !== "string") {
    return "";
  }

  const parts = address
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (parts.length >= 2) {
    return parts[1];
  }

  return "";
}

function toApiRestaurantShape(restaurant) {
  if (!restaurant || typeof restaurant !== "object") {
    return null;
  }

  if (restaurant.placeId && restaurant.location) {
    return {
      placeId: restaurant.placeId,
      name: restaurant.name || "",
      address: restaurant.address || "",
      district: restaurant.district || "",
      location: {
        lat: Number.isFinite(restaurant.location.lat) ? restaurant.location.lat : null,
        lng: Number.isFinite(restaurant.location.lng) ? restaurant.location.lng : null,
      },
      rating: Number.isFinite(restaurant.rating) ? restaurant.rating : null,
      priceLevel: Number.isFinite(restaurant.priceLevel) ? restaurant.priceLevel : null,
      cuisine: Array.isArray(restaurant.cuisine) ? restaurant.cuisine : [],
      photos: Array.isArray(restaurant.photos) ? restaurant.photos : [],
      distance: Number.isFinite(restaurant.distance) ? restaurant.distance : null,
      openNow:
        typeof restaurant.openNow === "boolean" ? restaurant.openNow : false,
    };
  }

  return {
    placeId: restaurant.restaurantId || "",
    name: restaurant.name || "",
    address: restaurant.address || "",
    district: extractDistrict(restaurant.address || ""),
    location: {
      lat: Number.isFinite(restaurant.latitude) ? restaurant.latitude : null,
      lng: Number.isFinite(restaurant.longitude) ? restaurant.longitude : null,
    },
    rating: Number.isFinite(restaurant.rating) ? restaurant.rating : null,
    priceLevel:
      PRICE_LEVEL_NUMBER_MAP[restaurant.priceLevel] ||
      PRICE_LEVEL_NUMBER_MAP[restaurant.priceLevelRaw] ||
      null,
    cuisine: deriveCuisineList(restaurant),
    photos: Array.isArray(restaurant.photos) ? restaurant.photos : [],
    distance: Number.isFinite(restaurant.distanceKm)
      ? restaurant.distanceKm
      : Number.isFinite(restaurant.distance)
        ? restaurant.distance
        : null,
    openNow:
      typeof restaurant.openNow === "boolean" ? restaurant.openNow : false,
  };
}

async function presentRankedRestaurants(restaurants) {
  const photoUris = await Promise.all(
    restaurants.map((restaurant) =>
      fetchPlacePhotoUri(Array.isArray(restaurant.photoNames) ? restaurant.photoNames[0] : "")
    )
  );

  return restaurants
    .map((restaurant, index) => {
      const photoUri = photoUris[index];

      return toApiRestaurantShape({
        ...restaurant,
        photos: photoUri ? [photoUri] : [],
      });
    })
    .filter(Boolean);
}

function presentSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") {
    return snapshot;
  }

  return {
    ...snapshot,
    restaurants: Array.isArray(snapshot.restaurants)
      ? snapshot.restaurants.map(toApiRestaurantShape).filter(Boolean)
      : [],
  };
}

module.exports = {
  presentRankedRestaurants,
  presentSnapshot,
};
