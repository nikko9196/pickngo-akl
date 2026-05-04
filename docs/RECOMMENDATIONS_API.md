# Recommendation and Selection API

This document covers the current session-level recommendation and shortlist APIs for Pick n Go AKL.

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

Update that file when questionnaire IDs change. Unknown question IDs are ignored safely.

## Authentication

All endpoints in this document require:

```text
Authorization: Bearer <JWT_TOKEN>
```

## Recommendation Endpoints

### 1. Generate Recommendations

`POST /api/sessions/:sessionId/recommendations`

Optional query string:
- `refresh=true` to bypass the snapshot cache

Rules:
- requester must be an authenticated session participant
- session status must be `generating`
- recommendation generation uses whatever usable questionnaire responses exist
- if Google returns zero valid matches, an empty snapshot is saved and the session stays in `generating`

Example:

```text
POST http://localhost:5001/api/sessions/<SESSION_ID>/recommendations?refresh=true
```

Body:

```json
{}
```

### 2. Get Latest Recommendation Snapshot

`GET /api/sessions/:sessionId/recommendations/latest`

Rules:
- requester must be an authenticated session participant
- returns the newest `RecommendationSnapshot`
- returns `404` if nothing has been generated yet

Example:

```text
GET http://localhost:5001/api/sessions/<SESSION_ID>/recommendations/latest
```

## Selection Endpoints

### 3. Save or Update My Selections

`PUT /api/sessions/:sessionId/selections/me`

Purpose:
- save the current user's shortlisted restaurants for the room

Important:
- frontend should send only `placeIds`
- backend looks up trusted restaurant data from the latest recommendation snapshot

Request body:

```json
{
  "placeIds": [
    "ChIJl9sFEapHDW0R8tcHwZWhNbc",
    "ChIJ_znwov1HDW0RAVadsiS4lV0"
  ]
}
```

Rules:
- requester must be an authenticated session participant
- session status must be `selecting`
- `placeIds` must be a non-empty array
- `placeIds` must not contain duplicates
- `placeIds.length` must not exceed `session.maxSelectionsPerUser`
- every `placeId` must exist in the latest recommendation snapshot

### 4. Get My Saved Selections

`GET /api/sessions/:sessionId/selections/me`

Purpose:
- restore the current user's saved shortlist on page reload

Rules:
- requester must be an authenticated session participant
- returns `404` if the user has not saved any selections yet

### 5. Get All Saved Selections for a Room

`GET /api/sessions/:sessionId/selections`

Purpose:
- fetch all saved participant shortlists for the session
- intended for wheel and later aggregation flow

Rules:
- requester must be an authenticated session participant
- returns only users who have already saved selections

## Sample Requests

### Generate Recommendations

```bash
curl -X POST "http://localhost:5001/api/sessions/<SESSION_ID>/recommendations?refresh=true" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Get Latest Recommendations

```bash
curl -X GET "http://localhost:5001/api/sessions/<SESSION_ID>/recommendations/latest" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### Save My Selections

```bash
curl -X PUT "http://localhost:5001/api/sessions/<SESSION_ID>/selections/me" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "placeIds": [
      "ChIJl9sFEapHDW0R8tcHwZWhNbc",
      "ChIJ_znwov1HDW0RAVadsiS4lV0"
    ]
  }'
```

### Get My Selections

```bash
curl -X GET "http://localhost:5001/api/sessions/<SESSION_ID>/selections/me" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

### Get All Selections

```bash
curl -X GET "http://localhost:5001/api/sessions/<SESSION_ID>/selections" \
  -H "Authorization: Bearer <JWT_TOKEN>"
```

## Sample Recommendation Response

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
      "topCuisines": ["japanese"],
      "preferredPrice": "$$",
      "dietary": [],
      "exclude": [],
      "coffeePreference": "yes",
      "openLatePreference": "no",
      "serviceMode": "",
      "specialRequestKeywords": [],
      "maxDistanceKm": 5,
      "latitude": -36.8485,
      "longitude": 174.7633
    },
    "restaurants": [
      {
        "placeId": "ChIJl9sFEapHDW0R8tcHwZWhNbc",
        "name": "Example Restaurant",
        "address": "123 Queen Street, Auckland CBD",
        "district": "Auckland CBD",
        "location": {
          "lat": -36.8485,
          "lng": 174.7633
        },
        "rating": 4.6,
        "priceLevel": 2,
        "cuisine": ["Japanese", "Cafe"],
        "photos": ["https://example.com/photo.jpg"],
        "distance": 0.4,
        "openNow": true
      }
    ]
  }
}
```

## Sample Save Selection Response

```json
{
  "message": "Saved your restaurant selections.",
  "selection": {
    "sessionId": "68000c5d7c1a2f36f0f0a111",
    "userId": "68000be73f1a2f36f0f0a101",
    "recommendationSnapshotId": "680012db3f1a2f36f0f0b321",
    "participant": {
      "userId": "68000be73f1a2f36f0f0a101",
      "roomDisplayName": "Backend Tester",
      "role": "host"
    },
    "selections": [
      {
        "placeId": "ChIJl9sFEapHDW0R8tcHwZWhNbc",
        "name": "Example Restaurant",
        "address": "123 Queen Street, Auckland CBD",
        "district": "Auckland CBD",
        "location": {
          "lat": -36.8485,
          "lng": 174.7633
        },
        "rating": 4.6,
        "priceLevel": 2,
        "cuisine": ["Japanese", "Cafe"],
        "distance": 0.4,
        "openNow": true
      }
    ],
    "submittedAt": "2026-04-30T10:00:00.000Z",
    "updatedAt": "2026-04-30T10:00:00.000Z"
  }
}
```

## Sample Get All Selections Response

```json
{
  "message": "Fetched saved restaurant selections for this room.",
  "selections": [
    {
      "sessionId": "68000c5d7c1a2f36f0f0a111",
      "userId": "68000be73f1a2f36f0f0a101",
      "recommendationSnapshotId": "680012db3f1a2f36f0f0b321",
      "participant": {
        "userId": "68000be73f1a2f36f0f0a101",
        "roomDisplayName": "Backend Tester",
        "role": "host"
      },
      "selections": [
        {
          "placeId": "ChIJl9sFEapHDW0R8tcHwZWhNbc",
          "name": "Example Restaurant",
          "address": "123 Queen Street, Auckland CBD",
          "district": "Auckland CBD",
          "location": {
            "lat": -36.8485,
            "lng": 174.7633
          },
          "rating": 4.6,
          "priceLevel": 2,
          "cuisine": ["Japanese", "Cafe"],
          "distance": 0.4,
          "openNow": true
        }
      ],
      "submittedAt": "2026-04-30T10:00:00.000Z",
      "updatedAt": "2026-04-30T10:00:00.000Z"
    }
  ]
}
```

## Common Error Cases

### `400`

Examples:

```json
{ "message": "placeIds must be an array." }
```

```json
{ "message": "placeIds cannot contain duplicates." }
```

```json
{ "message": "You can select at most 3 restaurants in this room." }
```

### `403`

```json
{ "message": "You are not a participant in this room." }
```

### `404`

Examples:

```json
{ "message": "Room not found." }
```

```json
{ "message": "No recommendation snapshot has been generated yet." }
```

```json
{ "message": "You have not saved any restaurant selections for this room yet." }
```

### `409`

Examples:

```json
{ "message": "Recommendations can only be generated when the room status is generating." }
```

```json
{ "message": "Restaurant selections can only be saved when the room status is selecting." }
```

## Practical Notes

- Recommendation generation reads from the existing `responses` collection.
- `Response.sessionId` is still stored as a string, so recommendation generation queries it using `session._id.toString()`.
- Group recommendations are generated at the session level, not per user.
- Google Text Search uses `locationBias`, which is only a bias. Distance is recalculated locally before ranking.
- Saved selections are stored in `sessionSelections`.
- The selection endpoints store trusted restaurant data from the latest recommendation snapshot rather than trusting frontend restaurant objects.
