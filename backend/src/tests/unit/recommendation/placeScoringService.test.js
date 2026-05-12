const {
  rankRestaurants,
  scoreRestaurant,
} = require("../../../services/placeScoringService");

function makeRestaurant(restaurantId, overrides = {}) {
  return {
    restaurantId,
    name: `Restaurant ${restaurantId}`,
    primaryType: "japanese_restaurant",
    types: [
      "restaurant",
      "coffee_shop",
      "late_night_restaurant",
      "meal_takeaway",
      "dessert_restaurant",
      "vegetarian",
    ],
    priceLevel: "$$",
    distanceKm: 1,
    rating: 4.6,
    userRatingCount: 150,
    ...overrides,
  };
}

const groupPrefs = {
  topCuisines: ["japanese"],
  dietary: ["vegetarian"],
  preferredPrice: "$$",
  coffeePreference: "yes",
  openLatePreference: "yes",
  serviceMode: "takeaway",
  specialRequestKeywords: ["dessert", "quiet"],
  maxDistanceKm: 5,
  exclude: [],
};

test("scoreRestaurant rewards matching recommendation signals", () => {
  const restaurant = scoreRestaurant(
    makeRestaurant("restaurant-1", {
      name: "Tokyo Cafe Dessert",
    }),
    groupPrefs
  );

  expect(restaurant).toBeTruthy();
  expect(restaurant.score).toBeGreaterThan(0);
  expect(restaurant.reasons.join(" | ")).toMatch(/Cuisine match: japanese/);
  expect(restaurant.reasons.join(" | ")).toMatch(/Matches preferred price level/);
  expect(restaurant.reasons.join(" | ")).toMatch(/Coffee-friendly option/);
});

test("rankRestaurants dedupes, filters blocked picks, and caps the shortlist", () => {
  const restaurants = Array.from({ length: 17 }, (_, index) =>
    makeRestaurant(`restaurant-${index}`, {
      rating: 4.9 - index * 0.05,
      userRatingCount: 500 - index * 10,
      distanceKm: 0.5 + index * 0.1,
    })
  );

  restaurants.push(
    makeRestaurant("restaurant-0", {
      name: "Restaurant restaurant-0 duplicate",
      rating: 3.8,
      userRatingCount: 25,
      distanceKm: 7,
      priceLevel: "$$$$",
    })
  );

  restaurants.push(
    makeRestaurant("blocked-restaurant", {
      name: "No Pork House",
      primaryType: "japanese_restaurant",
    })
  );

  const ranked = rankRestaurants(restaurants, {
    ...groupPrefs,
    exclude: ["pork"],
  });

  expect(ranked).toHaveLength(15);
  expect(
    ranked.filter((restaurant) => restaurant.restaurantId === "restaurant-0")
  ).toHaveLength(1);
  expect(
    ranked.every((restaurant) => restaurant.restaurantId !== "blocked-restaurant")
  ).toBe(true);
});
