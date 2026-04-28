const { roundNumber } = require("../utils/geo");
const LOCAL_RANKED_RESULT_LIMIT = 15;

const PRICE_LEVEL_SCORE_MAP = {
  $: 1,
  $$: 2,
  $$$: 3,
  $$$$: 4,
};

const COFFEE_SEARCH_TERMS = ["coffee", "cafe", "espresso", "brunch restaurant"];
const TAKEAWAY_SEARCH_TERMS = ["takeaway", "takeout", "meal takeaway", "to go"];
const LATE_NIGHT_SEARCH_TERMS = ["late night", "late night restaurant", "open late"];
const SPECIAL_REQUEST_SEARCH_TERMS = {
  dessert: ["dessert", "bakery", "ice cream", "patisserie", "sweet"],
  "outdoor seating": ["outdoor", "patio"],
  parking: ["parking"],
  quiet: ["quiet"],
  "group friendly": ["group dining", "large group", "family restaurant"],
};
const DEDICATED_SPECIAL_REQUEST_KEYWORDS = new Set([
  "coffee",
  "open late",
  "takeaway",
  "dine in",
]);

function normalizeText(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildRestaurantSearchText(restaurant) {
  return normalizeText(
    [restaurant.name, restaurant.primaryType, ...(restaurant.types || [])].join(" ")
  );
}

function termMatchesRestaurant(searchText, term) {
  const normalizedTerm = normalizeText(term);

  if (!normalizedTerm) {
    return false;
  }

  return searchText.includes(normalizedTerm);
}

function anyTermMatchesRestaurant(searchText, terms) {
  return terms.some((term) => termMatchesRestaurant(searchText, term));
}

function scoreCuisineMatches(restaurant, groupPrefs, reasons) {
  if (!(groupPrefs.topCuisines || []).length) {
    return 0;
  }

  const searchText = buildRestaurantSearchText(restaurant);
  const matchedCuisines = groupPrefs.topCuisines.filter((cuisine) =>
    termMatchesRestaurant(searchText, cuisine)
  );

  if (matchedCuisines.length === 0) {
    return -1;
  }

  reasons.push(`Cuisine match: ${matchedCuisines.join(", ")}`);
  return 5 + (matchedCuisines.length - 1) * 2;
}

function scoreDietaryMatches(restaurant, groupPrefs, reasons) {
  if (!(groupPrefs.dietary || []).length) {
    return 0;
  }

  const searchText = buildRestaurantSearchText(restaurant);
  const matchedDietary = groupPrefs.dietary.filter((dietaryValue) =>
    termMatchesRestaurant(searchText, dietaryValue)
  );

  if (matchedDietary.length === 0) {
    return 0;
  }

  reasons.push(`Dietary keyword match: ${matchedDietary.join(", ")}`);
  return 2 + matchedDietary.length;
}

function scoreCoffeePreference(restaurant, groupPrefs, reasons) {
  if (!["yes", "maybe"].includes(groupPrefs.coffeePreference)) {
    return 0;
  }

  const searchText = buildRestaurantSearchText(restaurant);

  if (!anyTermMatchesRestaurant(searchText, COFFEE_SEARCH_TERMS)) {
    return 0;
  }

  reasons.push("Coffee-friendly option");
  return groupPrefs.coffeePreference === "yes" ? 1.5 : 0.75;
}

function scorePriceMatch(restaurant, groupPrefs, reasons) {
  if (!groupPrefs.preferredPrice || !restaurant.priceLevel) {
    return 0;
  }

  const restaurantPrice = PRICE_LEVEL_SCORE_MAP[restaurant.priceLevel];
  const preferredPrice = PRICE_LEVEL_SCORE_MAP[groupPrefs.preferredPrice];

  if (!restaurantPrice || !preferredPrice) {
    return 0;
  }

  const difference = Math.abs(restaurantPrice - preferredPrice);

  if (difference === 0) {
    reasons.push("Matches preferred price level");
    return 3;
  }

  if (difference === 1) {
    reasons.push("Close to the preferred price level");
    return 1.5;
  }

  reasons.push("Far from the preferred price level");
  return -1.5;
}

function scoreOpenLatePreference(restaurant, groupPrefs, reasons) {
  if (groupPrefs.openLatePreference !== "yes") {
    return 0;
  }

  const searchText = buildRestaurantSearchText(restaurant);

  if (!anyTermMatchesRestaurant(searchText, LATE_NIGHT_SEARCH_TERMS)) {
    return 0;
  }

  reasons.push("Matches late-night preference");
  return 1.5;
}

function scoreServiceModePreference(restaurant, groupPrefs, reasons) {
  if (groupPrefs.serviceMode !== "takeaway") {
    return 0;
  }

  const searchText = buildRestaurantSearchText(restaurant);

  if (!anyTermMatchesRestaurant(searchText, TAKEAWAY_SEARCH_TERMS)) {
    return 0;
  }

  reasons.push("Supports takeaway-style dining");
  return 1.5;
}

function scoreDistance(restaurant, groupPrefs, reasons) {
  if (!Number.isFinite(restaurant.distanceKm)) {
    return 0;
  }

  if (restaurant.distanceKm <= groupPrefs.maxDistanceKm) {
    reasons.push(`Within preferred distance (${restaurant.distanceKm} km)`);
    return 3;
  }

  if (restaurant.distanceKm <= groupPrefs.maxDistanceKm * 1.5) {
    reasons.push(`Slightly outside preferred distance (${restaurant.distanceKm} km)`);
    return 1;
  }

  reasons.push(`Farther than preferred distance (${restaurant.distanceKm} km)`);
  return -2;
}

function scoreRating(restaurant, reasons) {
  if (!Number.isFinite(restaurant.rating)) {
    return 0;
  }

  if (restaurant.rating >= 4.5) {
    reasons.push(`Strong rating (${restaurant.rating})`);
    return 3;
  }

  if (restaurant.rating >= 4.0) {
    reasons.push(`Good rating (${restaurant.rating})`);
    return 2;
  }

  if (restaurant.rating >= 3.5) {
    reasons.push(`Acceptable rating (${restaurant.rating})`);
    return 1;
  }

  reasons.push(`Low rating (${restaurant.rating})`);
  return -1;
}

function scoreReviewCount(restaurant, reasons) {
  const reviewCount = restaurant.userRatingCount || 0;

  if (reviewCount >= 500) {
    reasons.push("Large review count");
    return 2;
  }

  if (reviewCount >= 100) {
    reasons.push("Solid review count");
    return 1;
  }

  if (reviewCount >= 25) {
    return 0.5;
  }

  return 0;
}

function scoreSpecialRequestKeywords(restaurant, groupPrefs, reasons) {
  if (!(groupPrefs.specialRequestKeywords || []).length) {
    return 0;
  }

  const searchText = buildRestaurantSearchText(restaurant);
  const matchedKeywords = (groupPrefs.specialRequestKeywords || []).filter((keyword) =>
    !DEDICATED_SPECIAL_REQUEST_KEYWORDS.has(keyword) &&
    anyTermMatchesRestaurant(
      searchText,
      SPECIAL_REQUEST_SEARCH_TERMS[keyword] || [keyword]
    )
  );

  if (matchedKeywords.length === 0) {
    return 0;
  }

  reasons.push(`Special request match: ${matchedKeywords.join(", ")}`);
  return Math.min(2, matchedKeywords.length * 0.75);
}

function isBlockedByExclusions(restaurant, groupPrefs) {
  const searchText = buildRestaurantSearchText(restaurant);
  return (groupPrefs.exclude || []).some((excludedValue) =>
    termMatchesRestaurant(searchText, excludedValue)
  );
}

function scoreRestaurant(restaurant, groupPrefs) {
  if (!restaurant?.restaurantId || !restaurant?.name) {
    return null;
  }

  if (isBlockedByExclusions(restaurant, groupPrefs)) {
    return null;
  }

  const reasons = [];
  let score = 0;

  score += scoreCuisineMatches(restaurant, groupPrefs, reasons);
  score += scoreDietaryMatches(restaurant, groupPrefs, reasons);
  score += scoreCoffeePreference(restaurant, groupPrefs, reasons);
  score += scorePriceMatch(restaurant, groupPrefs, reasons);
  score += scoreOpenLatePreference(restaurant, groupPrefs, reasons);
  score += scoreServiceModePreference(restaurant, groupPrefs, reasons);
  score += scoreDistance(restaurant, groupPrefs, reasons);
  score += scoreRating(restaurant, reasons);
  score += scoreReviewCount(restaurant, reasons);
  score += scoreSpecialRequestKeywords(restaurant, groupPrefs, reasons);

  return {
    ...restaurant,
    score: roundNumber(score, 2) || 0,
    reasons,
  };
}

function dedupeRestaurants(restaurants) {
  const restaurantsById = new Map();

  restaurants.forEach((restaurant) => {
    const existingRestaurant = restaurantsById.get(restaurant.restaurantId);

    if (!existingRestaurant || restaurant.score > existingRestaurant.score) {
      restaurantsById.set(restaurant.restaurantId, restaurant);
    }
  });

  return Array.from(restaurantsById.values());
}

function sortRankedRestaurants(restaurants) {
  return restaurants.sort((left, right) => {
    if (right.score !== left.score) {
      return right.score - left.score;
    }

    if ((right.rating || 0) !== (left.rating || 0)) {
      return (right.rating || 0) - (left.rating || 0);
    }

    if ((right.userRatingCount || 0) !== (left.userRatingCount || 0)) {
      return (right.userRatingCount || 0) - (left.userRatingCount || 0);
    }

    const leftDistance = Number.isFinite(left.distanceKm)
      ? left.distanceKm
      : Number.MAX_SAFE_INTEGER;
    const rightDistance = Number.isFinite(right.distanceKm)
      ? right.distanceKm
      : Number.MAX_SAFE_INTEGER;

    return leftDistance - rightDistance;
  });
}

function rankRestaurants(restaurants, groupPrefs) {
  const scoredRestaurants = restaurants
    .map((restaurant) => scoreRestaurant(restaurant, groupPrefs))
    .filter((restaurant) => restaurant && restaurant.score > 0);

  return sortRankedRestaurants(dedupeRestaurants(scoredRestaurants)).slice(
    0,
    LOCAL_RANKED_RESULT_LIMIT
  );
}

module.exports = {
  rankRestaurants,
  scoreRestaurant,
};
