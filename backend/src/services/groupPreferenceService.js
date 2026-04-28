const {
  DEFAULT_GROUP_LOCATION,
  DEFAULT_MAX_DISTANCE_KM,
} = require("../config/recommendationQuestionMap");
const { averageCoordinates, clampNumber, roundNumber } = require("../utils/geo");

const PRICE_TIE_BREAK_ORDER = ["$$", "$", "$$$", "$$$$"];

function rankListByPopularity(participants, key, limit = 3) {
  const counts = new Map();

  participants.forEach((participant) => {
    new Set(participant[key] || []).forEach((value) => {
      counts.set(value, (counts.get(value) || 0) + 1);
    });
  });

  return Array.from(counts.entries())
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return left[0].localeCompare(right[0]);
    })
    .slice(0, limit)
    .map(([value]) => value);
}

function combineUniqueValues(participants, key) {
  return Array.from(
    new Set(participants.flatMap((participant) => participant[key] || []).filter(Boolean))
  );
}

function determineMajorityChoice(participants, key, options = {}) {
  const { tieFallback = "", allowValues = [] } = options;
  const counts = new Map();

  participants.forEach((participant) => {
    const value = participant[key];

    if (!value) {
      return;
    }

    if (allowValues.length > 0 && !allowValues.includes(value)) {
      return;
    }

    counts.set(value, (counts.get(value) || 0) + 1);
  });

  const rankedCounts = Array.from(counts.entries()).sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }

    return left[0].localeCompare(right[0]);
  });

  if (rankedCounts.length === 0) {
    return "";
  }

  if (rankedCounts.length > 1 && rankedCounts[0][1] === rankedCounts[1][1]) {
    return tieFallback;
  }

  return rankedCounts[0][0];
}

function determinePreferredPrice(participants) {
  const counts = new Map();

  participants.forEach((participant) => {
    if (participant.preferredPrice) {
      counts.set(
        participant.preferredPrice,
        (counts.get(participant.preferredPrice) || 0) + 1
      );
    }
  });

  return Array.from(counts.entries())
    .sort((left, right) => {
      if (right[1] !== left[1]) {
        return right[1] - left[1];
      }

      return (
        PRICE_TIE_BREAK_ORDER.indexOf(left[0]) - PRICE_TIE_BREAK_ORDER.indexOf(right[0])
      );
    })?.[0]?.[0] || "";
}

function determineMaxDistanceKm(participants) {
  const distanceValues = participants
    .map((participant) => participant.maxDistanceKm)
    .filter((value) => Number.isFinite(value) && value > 0);

  if (distanceValues.length === 0) {
    return DEFAULT_MAX_DISTANCE_KM;
  }

  const averageDistance =
    distanceValues.reduce((total, value) => total + value, 0) / distanceValues.length;

  return roundNumber(clampNumber(averageDistance, 1, 50), 1);
}

function combineGroupPreferences(participants) {
  const averagedLocation =
    averageCoordinates(
      participants.map((participant) => ({
        latitude: participant.latitude,
        longitude: participant.longitude,
      }))
    ) || DEFAULT_GROUP_LOCATION;

  return {
    topCuisines: rankListByPopularity(participants, "cuisines"),
    preferredPrice: determinePreferredPrice(participants),
    dietary: combineUniqueValues(participants, "dietary"),
    exclude: combineUniqueValues(participants, "exclude"),
    coffeePreference: determineMajorityChoice(participants, "coffeePreference", {
      allowValues: ["yes", "maybe", "no"],
      tieFallback: "maybe",
    }),
    openLatePreference: determineMajorityChoice(participants, "openLatePreference", {
      allowValues: ["yes", "no"],
      tieFallback: "",
    }),
    serviceMode: determineMajorityChoice(participants, "serviceMode", {
      allowValues: ["dine_in", "takeaway", "either"],
      tieFallback: "either",
    }),
    specialRequestKeywords: rankListByPopularity(
      participants,
      "specialRequestKeywords",
      5
    ),
    maxDistanceKm: determineMaxDistanceKm(participants),
    latitude: averagedLocation.latitude,
    longitude: averagedLocation.longitude,
  };
}

module.exports = {
  combineGroupPreferences,
};
