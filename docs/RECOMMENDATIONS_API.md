# Recommendation API

This document covers the session-level recommendation feature for Pick n Go AKL.

## Backend Environment

Copy [backend/.env.example](../backend/.env.example) to `backend/.env` and fill in the values.

Required keys:

```env
PORT=5001
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname?retryWrites=true&w=majority
JWT_SECRET=change-this-jwt-secret
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_PLACES_API_KEY=your-google-places-api-key
CLIENT_BASE_URL=http://localhost:5173
```

## Question Mapping

Recommendation parsing is driven by [backend/src/config/recommendationQuestionMap.js](../backend/src/config/recommendationQuestionMap.js).

Update that file when your questionnaire IDs become final. Unknown question IDs are ignored safely.

## Endpoints

### Generate Recommendations

`POST /api/sessions/:sessionId/recommendations`

Optional query string:

- `refresh=true` to bypass the 10-minute snapshot cache

Rules:

- requester must be an authenticated session participant
- session status must be `generating`
- the backend uses whatever usable responses exist at the time of the request
- if Google returns zero valid matches, an empty snapshot is saved and the session stays in `generating`

### Get Latest Recommendations

`GET /api/sessions/:sessionId/recommendations/latest`

Rules:

- requester must be an authenticated session participant
- returns the newest `RecommendationSnapshot`
- returns `404` if nothing has been generated yet

## Sample Postman Requests

### 1. Generate Recommendations

Method: `POST`

URL:

```text
http://localhost:5001/api/sessions/68000c5d7c1a2f36f0f0a111/recommendations
```

Headers:

```text
Authorization: Bearer <JWT_TOKEN>
Content-Type: application/json
```

Optional cache-bypass URL:

```text
http://localhost:5001/api/sessions/68000c5d7c1a2f36f0f0a111/recommendations?refresh=true
```

Body:

```json
{}
```

### 2. Get Latest Recommendation Snapshot

Method: `GET`

URL:

```text
http://localhost:5001/api/sessions/68000c5d7c1a2f36f0f0a111/recommendations/latest
```

Headers:

```text
Authorization: Bearer <JWT_TOKEN>
```

## Sample JSON Response

```json
{
  "cached": false,
  "message": "Generated group recommendations.",
  "sessionStatus": "selecting",
  "snapshot": {
    "_id": "680012db3f1a2f36f0f0b321",
    "sessionId": "68000c5d7c1a2f36f0f0a111",
    "generatedAt": "2026-04-17T09:15:07.512Z",
    "groupPrefs": {
      "topCuisines": ["japanese", "korean"],
      "preferredPrice": "$$",
      "dietary": ["vegetarian"],
      "exclude": ["seafood"],
      "maxDistanceKm": 5,
      "latitude": -36.8485,
      "longitude": 174.7633
    },
    "restaurants": [
      {
        "restaurantId": "ChIJ000000000000000001",
        "name": "Example Bistro",
        "address": "123 Queen Street, Auckland CBD, Auckland 1010",
        "rating": 4.6,
        "userRatingCount": 320,
        "priceLevelRaw": "PRICE_LEVEL_MODERATE",
        "priceLevel": "$$",
        "primaryType": "japanese_restaurant",
        "types": ["restaurant", "food", "japanese_restaurant"],
        "latitude": -36.8501,
        "longitude": 174.764,
        "mapsUrl": "https://maps.google.com/?cid=123456789",
        "distanceKm": 0.3,
        "score": 15,
        "reasons": [
          "Cuisine match: japanese",
          "Dietary keyword match: vegetarian",
          "Matches preferred price level",
          "Within preferred distance (0.3 km)",
          "Strong rating (4.6)",
          "Solid review count"
        ]
      }
    ]
  }
}
```

## Practical Notes

- Recommendation generation reads from the existing `responses` collection.
- `Response.sessionId` is still stored as a string, so recommendation generation queries it using `session._id.toString()`.
- Group recommendations are generated at the session level, not per user.
- Google Text Search uses `locationBias`, which is only a bias. Distance is recalculated locally before ranking.
