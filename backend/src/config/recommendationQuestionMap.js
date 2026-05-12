// Fallback search center for recommendation generation when no session location is available.
// This is intentionally set around the University of Auckland / Auckland CBD area.
const DEFAULT_GROUP_LOCATION = Object.freeze({
  latitude: -36.8485,
  longitude: 174.7633,
});

const DEFAULT_MAX_DISTANCE_KM = 5;
const SNAPSHOT_CACHE_WINDOW_MINUTES = 10;

// Only map questions that the current recommendation pipeline actually consumes.
const RECOMMENDATION_QUESTION_MAP = Object.freeze({
  cuisines: {
    questionIds: ["q_cuisine_1"],
    categories: ["cuisine"],
    valueType: "list",
  },
  dietary: {
    questionIds: ["q_dietary_1"],
    categories: ["dietary"],
    valueType: "list",
  },
  preferredPrice: {
    questionIds: ["q_budget_1"],
    categories: ["budget"],
    valueType: "price",
  },
  coffeePreference: {
    questionIds: ["q_coffee_1", "coffee", "coffee_preference"],
    categories: ["coffee"],
    valueType: "coffee",
  },
  openLatePreference: {
    questionIds: ["q_open_late_1", "open_late", "open_late_preference"],
    categories: ["open_late", "late_hours"],
    valueType: "open_late",
  },
  serviceMode: {
    questionIds: ["q_service_mode_1", "service_mode", "dining_mode"],
    categories: ["service_mode", "dining_mode"],
    valueType: "service_mode",
  },
  specialRequests: {
    questionIds: ["q_note_1", "special_request", "special_requests", "notes"],
    categories: ["special_request", "notes"],
    valueType: "text",
  },
  exclude: {
    questionIds: [
      "exclude",
      "excluded_foods",
      "excluded_cuisines",
      "avoid",
      "dislikes",
    ],
    categories: ["exclude", "avoid", "dislikes"],
    valueType: "list",
  },
  latitude: {
    questionIds: ["latitude", "lat"],
    categories: ["latitude"],
    valueType: "number",
  },
  longitude: {
    questionIds: ["longitude", "lng", "lon"],
    categories: ["longitude"],
    valueType: "number",
  },
  coordinates: {
    questionIds: ["coordinates", "location_coordinates", "lat_lng"],
    categories: ["location"],
    valueType: "coordinates",
  },
  maxDistanceKm: {
    questionIds: [
      "max_distance",
      "max_distance_km",
      "distance_km",
      "travel_distance",
    ],
    categories: ["distance", "travel_distance"],
    valueType: "number",
  },
});

module.exports = {
  DEFAULT_GROUP_LOCATION,
  DEFAULT_MAX_DISTANCE_KM,
  RECOMMENDATION_QUESTION_MAP,
  SNAPSHOT_CACHE_WINDOW_MINUTES,
};
