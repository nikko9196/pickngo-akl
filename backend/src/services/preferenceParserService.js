const { RECOMMENDATION_QUESTION_MAP } = require("../config/recommendationQuestionMap");

const EMPTY_SELECTION_TERMS = new Set([
  "na",
  "n_a",
  "n a",
  "none",
  "nothing",
  "no",
  "nope",
]);

const FIELD_EMPTY_SELECTION_TERMS = {
  dietary: new Set([
    ...EMPTY_SELECTION_TERMS,
    "no_restrictions",
    "no_dietary_restrictions",
  ]),
  exclude: new Set([
    ...EMPTY_SELECTION_TERMS,
    "nothing_to_avoid",
    "no_exclusions",
    "no_dislikes",
  ]),
};

const DIETARY_SPECIAL_REQUEST_HINTS = [
  { value: "vegetarian", pattern: /\bvegetarian\b/ },
  { value: "vegan", pattern: /\bvegan\b/ },
  { value: "halal", pattern: /\bhalal\b/ },
  { value: "gluten free", pattern: /\bgluten[\s-]?free\b/ },
  { value: "dairy free", pattern: /\bdairy[\s-]?free\b/ },
  { value: "nut free", pattern: /\bnut[\s-]?free\b/ },
];

const EXCLUDE_SPECIAL_REQUEST_HINTS = [
  { value: "seafood", patterns: [/\b(?:no|avoid|without)\s+seafood\b/] },
  { value: "spicy food", patterns: [/\b(?:no|avoid|without)\s+spicy\b/, /\bnot\s+spicy\b/] },
  { value: "beef", patterns: [/\b(?:no|avoid|without)\s+beef\b/] },
  { value: "pork", patterns: [/\b(?:no|avoid|without)\s+pork\b/] },
  { value: "chicken", patterns: [/\b(?:no|avoid|without)\s+chicken\b/] },
  { value: "dairy", patterns: [/\b(?:no|avoid|without)\s+dairy\b/] },
  { value: "nuts", patterns: [/\b(?:no|avoid|without)\s+nuts?\b/] },
  { value: "raw food", patterns: [/\b(?:no|avoid|without)\s+raw\b/] },
];

const SPECIAL_REQUEST_KEYWORD_HINTS = [
  {
    keyword: "coffee",
    patterns: [/\bcoffee\b/, /\bcafe\b/, /\bcafé\b/, /\bespresso\b/],
    coffeePreference: "yes",
  },
  {
    keyword: "open late",
    patterns: [/\bopen\s+late\b/, /\blate[\s-]?night\b/, /\bopen\s+later\b/],
    openLatePreference: "yes",
  },
  {
    keyword: "takeaway",
    patterns: [/\btake[\s-]?away\b/, /\btakeout\b/, /\bto\s+go\b/, /\bgrab\s+and\s+go\b/],
    serviceMode: "takeaway",
  },
  {
    keyword: "dine in",
    patterns: [/\bdine[\s-]?in\b/, /\beat(?:ing)?\s+there\b/, /\bsit[\s-]?down\b/],
    serviceMode: "dine_in",
  },
  {
    keyword: "dessert",
    patterns: [/\bdessert\b/, /\bsomething\s+sweet\b/, /\bsweets?\b/],
  },
  {
    keyword: "quiet",
    patterns: [/\bquiet\b/, /\bnot\s+too\s+loud\b/, /\bpeaceful\b/],
  },
  {
    keyword: "outdoor seating",
    patterns: [/\boutdoor\b/, /\bpatio\b/, /\boutside\b/],
  },
  {
    keyword: "group friendly",
    patterns: [/\bgroup[\s-]?friendly\b/, /\bbig\s+group\b/, /\blarge\s+table\b/],
  },
  {
    keyword: "parking",
    patterns: [/\bparking\b/],
  },
];

function normalizeLookupKey(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeListValue(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function normalizeFreeTextValue(value) {
  if (typeof value !== "string") {
    return "";
  }

  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function splitResponseValues(rawValue) {
  if (typeof rawValue !== "string") {
    return [];
  }

  return rawValue
    .split(/[,\n;]+/)
    .map((value) => normalizeListValue(value))
    .filter(Boolean);
}

function dedupePreserveOrder(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function removeEmptySelections(values, fieldKey) {
  const normalizedValues = dedupePreserveOrder(values);
  const emptyTerms = FIELD_EMPTY_SELECTION_TERMS[fieldKey];

  if (!emptyTerms) {
    return normalizedValues;
  }

  const meaningfulValues = normalizedValues.filter(
    (value) => !emptyTerms.has(normalizeLookupKey(value))
  );

  return meaningfulValues;
}

function normalizePricePreference(rawValue) {
  if (typeof rawValue !== "string") {
    return "";
  }

  const trimmedValue = rawValue.trim();

  if (/^\${1,4}$/.test(trimmedValue)) {
    return trimmedValue;
  }

  const normalizedValue = normalizeLookupKey(trimmedValue);
  const aliasMap = new Map([
    ["cheap", "$"],
    ["inexpensive", "$"],
    ["budget", "$"],
    ["affordable", "$"],
    ["moderate", "$$"],
    ["mid_range", "$$"],
    ["medium", "$$"],
    ["average", "$$"],
    ["expensive", "$$$"],
    ["high_end", "$$$"],
    ["premium", "$$$$"],
    ["luxury", "$$$$"],
    ["very_expensive", "$$$$"],
  ]);

  return aliasMap.get(normalizedValue) || "";
}

function parseNumericValue(rawValue) {
  if (typeof rawValue !== "string") {
    return null;
  }

  const match = rawValue.match(/-?\d+(?:\.\d+)?/);

  if (!match) {
    return null;
  }

  const parsedValue = Number(match[0]);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

function parseCoordinatePair(rawValue) {
  if (typeof rawValue !== "string") {
    return null;
  }

  const matches = rawValue.match(/-?\d+(?:\.\d+)?/g);

  if (!matches || matches.length < 2) {
    return null;
  }

  const latitude = Number(matches[0]);
  const longitude = Number(matches[1]);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return { latitude, longitude };
}

function normalizeCoffeePreference(rawValue) {
  const normalizedValue = normalizeLookupKey(rawValue);

  if (["yes", "y"].includes(normalizedValue)) {
    return "yes";
  }

  if (["maybe", "sometimes"].includes(normalizedValue)) {
    return "maybe";
  }

  if (["no", "n"].includes(normalizedValue)) {
    return "no";
  }

  return "";
}

function normalizeOpenLatePreference(rawValue) {
  const normalizedValue = normalizeLookupKey(rawValue);

  if (["yes", "y"].includes(normalizedValue)) {
    return "yes";
  }

  if (["no", "n"].includes(normalizedValue)) {
    return "no";
  }

  return "";
}

function normalizeServiceMode(rawValue) {
  const normalizedValue = normalizeLookupKey(rawValue);

  if (["dine_in", "eat_there", "sit_down"].includes(normalizedValue)) {
    return "dine_in";
  }

  if (["takeaway", "take_away", "takeout", "to_go"].includes(normalizedValue)) {
    return "takeaway";
  }

  if (["either", "anything", "no_preference"].includes(normalizedValue)) {
    return "either";
  }

  return "";
}

function normalizeSpecialRequestText(rawValue) {
  const normalizedText = normalizeFreeTextValue(rawValue);

  if (!normalizedText) {
    return "";
  }

  if (EMPTY_SELECTION_TERMS.has(normalizeLookupKey(normalizedText))) {
    return "";
  }

  return normalizedText;
}

function extractSpecialRequestHints(rawValue) {
  const text = normalizeSpecialRequestText(rawValue);

  if (!text) {
    return {
      text: "",
      dietary: [],
      exclude: [],
      keywords: [],
      coffeePreference: "",
      openLatePreference: "",
      serviceMode: "",
    };
  }

  const dietary = DIETARY_SPECIAL_REQUEST_HINTS.filter(({ pattern }) =>
    pattern.test(text)
  ).map(({ value }) => value);

  const exclude = EXCLUDE_SPECIAL_REQUEST_HINTS.filter(({ patterns }) =>
    patterns.some((pattern) => pattern.test(text))
  ).map(({ value }) => value);

  const matchedKeywordHints = SPECIAL_REQUEST_KEYWORD_HINTS.filter(({ patterns }) =>
    patterns.some((pattern) => pattern.test(text))
  );

  return {
    text,
    dietary,
    exclude,
    keywords: matchedKeywordHints.map(({ keyword }) => keyword),
    coffeePreference:
      matchedKeywordHints.find((hint) => hint.coffeePreference)?.coffeePreference || "",
    openLatePreference:
      matchedKeywordHints.find((hint) => hint.openLatePreference)?.openLatePreference || "",
    serviceMode: matchedKeywordHints.find((hint) => hint.serviceMode)?.serviceMode || "",
  };
}

function createEmptyParticipantPreference(userId) {
  return {
    userId,
    cuisines: [],
    dietary: [],
    exclude: [],
    preferredPrice: "",
    coffeePreference: "",
    openLatePreference: "",
    serviceMode: "",
    specialRequests: [],
    specialRequestKeywords: [],
    latitude: null,
    longitude: null,
    maxDistanceKm: null,
  };
}

function buildQuestionLookup(questionLists) {
  const lookup = new Map();

  questionLists.forEach((questionList) => {
    const normalizedCategory = normalizeLookupKey(questionList.category);

    (questionList.questionList || []).forEach((question) => {
      lookup.set(normalizeLookupKey(question.questionId), {
        category: normalizedCategory,
        questionType: normalizeLookupKey(question.questionType),
      });
    });
  });

  return lookup;
}

function resolvePreferenceField(questionId, questionContext) {
  const normalizedQuestionId = normalizeLookupKey(questionId);

  // Match through config so questionnaire changes stay isolated to one file.
  return Object.entries(RECOMMENDATION_QUESTION_MAP).find(([, fieldConfig]) => {
    const hasQuestionIdMatch = (fieldConfig.questionIds || []).some(
      (mappedQuestionId) => normalizeLookupKey(mappedQuestionId) === normalizedQuestionId
    );

    if (hasQuestionIdMatch) {
      return true;
    }

    return (fieldConfig.categories || []).some(
      (mappedCategory) =>
        normalizeLookupKey(mappedCategory) === normalizeLookupKey(questionContext?.category || "")
    );
  })?.[0] || "";
}

function applyMappedResponse(participant, fieldKey, rawAnswer) {
  switch (fieldKey) {
    case "cuisines":
      participant[fieldKey] = dedupePreserveOrder([
        ...participant[fieldKey],
        ...splitResponseValues(rawAnswer),
      ]);
      break;
    case "dietary":
    case "exclude":
      participant[fieldKey] = dedupePreserveOrder([
        ...participant[fieldKey],
        ...removeEmptySelections(splitResponseValues(rawAnswer), fieldKey),
      ]);
      break;
    case "preferredPrice": {
      const normalizedPrice = normalizePricePreference(rawAnswer);

      if (normalizedPrice) {
        participant.preferredPrice = normalizedPrice;
      }

      break;
    }
    case "coffeePreference": {
      const coffeePreference = normalizeCoffeePreference(rawAnswer);

      if (coffeePreference) {
        participant.coffeePreference = coffeePreference;
      }

      break;
    }
    case "openLatePreference": {
      const openLatePreference = normalizeOpenLatePreference(rawAnswer);

      if (openLatePreference) {
        participant.openLatePreference = openLatePreference;
      }

      break;
    }
    case "serviceMode": {
      const serviceMode = normalizeServiceMode(rawAnswer);

      if (serviceMode) {
        participant.serviceMode = serviceMode;
      }

      break;
    }
    case "specialRequests": {
      const specialRequest = extractSpecialRequestHints(rawAnswer);

      if (!specialRequest.text) {
        break;
      }

      participant.specialRequests = dedupePreserveOrder([
        ...participant.specialRequests,
        specialRequest.text,
      ]);
      participant.specialRequestKeywords = dedupePreserveOrder([
        ...participant.specialRequestKeywords,
        ...specialRequest.keywords,
      ]);
      participant.dietary = dedupePreserveOrder([
        ...participant.dietary,
        ...specialRequest.dietary,
      ]);
      participant.exclude = dedupePreserveOrder([
        ...participant.exclude,
        ...specialRequest.exclude,
      ]);

      if (!participant.coffeePreference && specialRequest.coffeePreference) {
        participant.coffeePreference = specialRequest.coffeePreference;
      }

      if (!participant.openLatePreference && specialRequest.openLatePreference) {
        participant.openLatePreference = specialRequest.openLatePreference;
      }

      if (!participant.serviceMode && specialRequest.serviceMode) {
        participant.serviceMode = specialRequest.serviceMode;
      }

      break;
    }
    case "latitude": {
      const latitude = parseNumericValue(rawAnswer);

      if (Number.isFinite(latitude) && latitude >= -90 && latitude <= 90) {
        participant.latitude = latitude;
      }

      break;
    }
    case "longitude": {
      const longitude = parseNumericValue(rawAnswer);

      if (Number.isFinite(longitude) && longitude >= -180 && longitude <= 180) {
        participant.longitude = longitude;
      }

      break;
    }
    case "coordinates": {
      const coordinates = parseCoordinatePair(rawAnswer);

      if (coordinates) {
        participant.latitude = coordinates.latitude;
        participant.longitude = coordinates.longitude;
      }

      break;
    }
    case "maxDistanceKm": {
      const maxDistanceKm = parseNumericValue(rawAnswer);

      if (Number.isFinite(maxDistanceKm) && maxDistanceKm > 0) {
        participant.maxDistanceKm = maxDistanceKm;
      }

      break;
    }
    default:
      break;
  }
}

function participantHasUsablePreferences(participant) {
  return Boolean(
    participant.cuisines.length ||
      participant.dietary.length ||
      participant.exclude.length ||
      participant.preferredPrice ||
      ["yes", "maybe"].includes(participant.coffeePreference) ||
      participant.openLatePreference === "yes" ||
      ["dine_in", "takeaway"].includes(participant.serviceMode) ||
      participant.specialRequestKeywords.length ||
      Number.isFinite(participant.latitude) ||
      Number.isFinite(participant.longitude) ||
      Number.isFinite(participant.maxDistanceKm)
  );
}

function parseParticipantPreferences(responses, questionLookup) {
  const participantsByUserId = new Map();

  responses.forEach((response) => {
    if (!response || response.skipped || !response.userId) {
      return;
    }

    const questionId = response.questionId || "";
    const normalizedQuestionId = normalizeLookupKey(questionId);
    const questionContext = questionLookup.get(normalizedQuestionId);
    const matchedField = resolvePreferenceField(questionId, questionContext);

    if (!matchedField) {
      return;
    }

    const participant =
      participantsByUserId.get(response.userId) ||
      createEmptyParticipantPreference(response.userId);

    applyMappedResponse(participant, matchedField, response.answer);
    participantsByUserId.set(response.userId, participant);
  });

  return Array.from(participantsByUserId.values()).map((participant) => ({
    ...participant,
    cuisines: dedupePreserveOrder(participant.cuisines),
    dietary: removeEmptySelections(dedupePreserveOrder(participant.dietary), "dietary"),
    exclude: removeEmptySelections(dedupePreserveOrder(participant.exclude), "exclude"),
    specialRequests: dedupePreserveOrder(participant.specialRequests),
    specialRequestKeywords: dedupePreserveOrder(participant.specialRequestKeywords),
  }));
}

module.exports = {
  buildQuestionLookup,
  createEmptyParticipantPreference,
  normalizeLookupKey,
  parseParticipantPreferences,
  participantHasUsablePreferences,
};
