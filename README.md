# Have A Byte

Have A Byte is a full-stack web project for CS732. Our team developed PicknGo AKL, a collaborative restaurant decision-making web application that helps groups discover, shortlist, and randomly select restaurants together through a shared spinning wheel experience.

This repository currently contains a React frontend, an Express backend, and a MongoDB Atlas database connection.

## Team Members

- Cheng Cheng (`cche860@aucklanduni.ac.nz`)
- Annie Lin (`yiln996@aucklanduni.ac.nz`)
- Nhu (Nikko) Pham (`dpha478@aucklanduni.ac.nz`)
- Phuong (Paige) Phan (`ppha961@aucklanduni.ac.nz`)
- Vincent Su (`hsu901@aucklanduni.ac.nz`)
- Cynthia Xie (`zxie211@aucklanduni.ac.nz`)

## Tech Stack

### Frontend
- React 19
- React Router DOM 7
- Vite 8

### Backend
- Node.js
- Express 5
- Mongoose 9
- JWT authentication
- native `fetch` for Google Places requests

### Database and External Services
- MongoDB Atlas
- Google Places API
- Google Maps API

## Current Session Flow

1. User signs in or continues as a guest.
2. Host creates a room.
3. Participants join with the room code.
4. Host starts the room.
5. Participants answer the active questionnaire.
6. Session moves to `generating`.
7. Recommendation page generates and loads shared restaurant recommendations.
8. Session moves to `selecting`.
9. Each participant can save their shortlisted restaurants.
10. Wheel is built and session moves to `spinning`.
11. Every marks themeselves as ready to lock their picks.
12. Host spins the wheel.
13. Backend selects a result and session moves to `voting`.
14. Participants vote to accept the result or respin.
15. Based on the voting result:
    - If the majority votes to respin, the selected restaurant is removed and the session moves back to `spinning`
    - If the vote results in a tie, the selected restaurant is also removed and the session moves back to `spinning` to avoid repeated tie re-votes.
    - If the group accepts the result, or the wheel reaches the final spin, session moves to `completed`.
18. Final result page shows the selected restaurant.

Current session statuses in the app:
- `waiting`
- `questioning`
- `generating`
- `selecting`
- `spinning`
- `voting`
- `completed`

## Prerequisites

- Node.js 18 or higher
- npm 9 or higher
- MongoDB Atlas connection string
- Google Places API key

Check your local versions:

```bash
node -v
npm -v
```

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/UOA-CS732-S1-2026/group-project-have-a-byte.git
cd group-project-have-a-byte
```

### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

Copy [backend/.env.example](backend/.env.example) to `backend/.env` and fill in the values:

```env
PORT=5001
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname?retryWrites=true&w=majority
JWT_SECRET=change-this-jwt-secret
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_PLACES_API_KEY=your-google-places-api-key
CLIENT_BASE_URL=http://localhost:5173
```

Backend variable notes:
- `PORT`: backend development server port
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: secret used to sign authentication tokens
- `GOOGLE_CLIENT_ID`: required only if Google sign-in is enabled
- `GOOGLE_PLACES_API_KEY`: required for recommendation generation
- `CLIENT_BASE_URL`: frontend base URL used to generate room join links

### 3. Install Frontend Dependencies

```bash
cd ../frontend
npm install
```

Create `frontend/.env`:

```env
VITE_PORT=5173
VITE_API_BASE_URL=http://localhost:5001
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
VITE_USE_MOCK_RECOMMENDATIONS=false
```

Frontend variable notes:
- `VITE_PORT`: frontend development server port
- `VITE_API_BASE_URL`: backend base URL
- `VITE_GOOGLE_CLIENT_ID`: required only if Google sign-in is enabled
- `VITE_USE_MOCK_RECOMMENDATIONS`: optional flag for mock recommendation mode; set to `false` to use the real backend
- `VITE_GOOGLE_MAPS_API_KEY`: required for Google Maps and restaurant location features.

## Running the App

Use two terminals.

### Terminal 1: Backend

```bash
cd backend
npm run dev
```

The backend runs on `http://localhost:5001` by default.

### Terminal 2: Frontend

```bash
cd frontend
npm run dev
```

The frontend runs on `http://localhost:5173` by default.

If you change the backend port, update `VITE_API_BASE_URL` in `frontend/.env`.

## Project Structure

```text
group-project-have-a-byte/
|-- frontend/
|   |-- public/
|   |-- src/
|   |   |-- api/                 # frontend API helpers
|   |   |-- components/          # reusable UI components
|   |   |-- context/             # auth and shared state
|   |   |-- pages/               # page-level UI
|   |   |-- utils/               # frontend helpers and mocks
|   |   |-- App.jsx              # frontend route definitions
|   |   |-- main.jsx             # frontend entry point
|   |-- package.json
|   |-- vite.config.js
|-- backend/
|   |-- scripts/                 # manual backend scripts
|   |-- src/
|   |   |-- config/              # backend config
|   |   |-- controllers/         # route handlers
|   |   |-- middleware/          # express middleware
|   |   |-- models/              # mongoose models
|   |   |-- routes/              # route definitions
|   |   |-- services/            # business logic
|   |   |-- utils/               # shared backend helpers
|   |   |-- app.js               # backend entry file
|   |-- .env.example
|   |-- package.json
|-- docs/
|   |-- RECOMMENDATIONS_API.md
|-- README.md
```

## Current Frontend Routes

Main frontend routes currently implemented:
- `/`
- `/auth`
- `/rooms/create`
- `/join`
- `/join/:sessionCode`
- `/sessions/:sessionCode`
- `/sessions/:sessionCode/question`
- `/sessions/:sessionCode/recommendation`

## Current API

Notes:
- `sessionCode` is the public room code
- `sessionId` is the MongoDB `_id` for a session
- all routes except the public auth routes require authentication

### Auth

- `POST /api/auth/register`
  - register a local user
- `POST /api/auth/login`
  - log in a local user
- `POST /api/auth/google`
  - log in with Google Sign-In
- `POST /api/auth/guest`
  - create and log in a guest user
- `GET /api/auth/me`
  - get the currently authenticated user

### Questions

- `GET /api/questions`
  - return the active question lists for the questionnaire stage

### Sessions

- `POST /api/sessions`
  - create a new room
- `POST /api/sessions/join`
  - join a room using `sessionCode`
- `GET /api/sessions/mine`
  - get all rooms for the current user
- `GET /api/sessions/code/:sessionCode`
  - get a room by public code
- `GET /api/sessions/:sessionId/progress`
  - get questionnaire completion progress
- `PATCH /api/sessions/:sessionId`
  - update room settings such as `maxParticipants` and `maxSelectionsPerUser`
- `PATCH /api/sessions/:sessionId/status`
  - update the room status
- `DELETE /api/sessions/:sessionId`
  - delete a room as host

### Questionnaire Responses

- `POST /api/sessions/:sessionId/responses`
  - submit or update one participant answer

### Recommendations

- `POST /api/sessions/:sessionId/recommendations`
  - generate shared recommendations for the room
- `GET /api/sessions/:sessionId/recommendations/latest`
  - fetch the latest saved recommendation snapshot

### Saved Selections

- `PUT /api/sessions/:sessionId/selections/me`
  - save or update the current user's shortlisted restaurants
- `GET /api/sessions/:sessionId/selections/me`
  - fetch the current user's saved shortlist
- `GET /api/sessions/:sessionId/selections`
  - fetch all saved shortlists for the room

## Recommendation and Selection Flow

### Recommendation generation

The backend recommendation flow currently:
1. loads questionnaire responses from `responses`
2. parses them into participant preferences
3. combines them into shared group preferences
4. calls Google Places Text Search
5. normalizes and ranks returned restaurants
6. saves a `RecommendationSnapshot`
7. returns the final restaurant list

Important behavior:
- recommendation generation only works when the room status is `generating`
- if recommendations are generated successfully, the room moves to `selecting`
- the frontend recommendation page uses the real backend flow by default

### Selection saving

The frontend saves shortlisted restaurants by sending only `placeIds`.

The backend:
- validates the user is a room participant
- validates the room is in `selecting`
- validates the requested place IDs exist in the latest recommendation snapshot
- saves a trusted shortlist into `sessionSelections`

## Database Collections

The app currently uses these main MongoDB collections.

### `users`

Defined by [backend/src/models/User.js](backend/src/models/User.js).

Key fields:
- `_id`
- `displayName`
- `email`
- `avatarUrl`
- `authProviders`
- `isAdmin`
- `lastLoginAt`
- `createdAt`
- `updatedAt`

### `questionLists`

Defined by [backend/src/models/QuestionList.js](backend/src/models/QuestionList.js).

Key fields:
- `_id`
- `questionListId`
- `category`
- `isActive`
- `questionList`
  - `questionId`
  - `questionType`
  - `questionText`
  - `questionValue`

### `responses`

Defined by [backend/src/models/Response.js](backend/src/models/Response.js).

Key fields:
- `_id`
- `sessionId`
- `userId`
- `questionId`
- `answer`
- `skipped`
- `createdAt`

Important note:
- `Response.sessionId` and `Response.userId` are currently stored as strings

### `sessions`

Defined by [backend/src/models/Session.js](backend/src/models/Session.js).

Key fields:
- `_id`
- `hostUserId`
- `sessionCode`
- `joinUrl`
- `status`
- `maxParticipants`
- `maxSelectionsPerUser`
- `location`
- `participants`
  - `userId`
  - `role`
  - `roomDisplayName`
  - `joinedAt`
  - `isReady`
- `remindedUserIds`
- `wheelItems`
- `spinRoundId`
- `currentWheelResult`
- `lastWheelResult`
- `finalWheelResult`
- `voteSummary`
- `lastVoteSummary`
- `resultRatings`
- `createdAt`
- `updatedAt`

### `recommendationSnapshots`

Defined by [backend/src/models/RecommendationSnapshot.js](backend/src/models/RecommendationSnapshot.js).

Key fields:
- `_id`
- `sessionId`
- `generatedAt`
- `usedFallback`
- `fallbackReason`
- `groupPrefs`
- `restaurants`

Each saved restaurant currently includes frontend-facing fields such as:
- `placeId`
- `name`
- `address`
- `district`
- `location`
- `rating`
- `priceLevel`
- `cuisine`
- `photos`
- `distance`
- `openNow`

### `sessionSelections`

Defined by [backend/src/models/SessionSelection.js](backend/src/models/SessionSelection.js).

Key fields:
- `_id`
- `sessionId`
- `userId`
- `recommendationSnapshotId`
- `selections`
  - `placeId`
  - `name`
  - `address`
  - `district`
  - `location`
  - `rating`
  - `priceLevel`
  - `cuisine`
  - `distance`
  - `openNow`
- `submittedAt`
- `updatedAt`

## ID Notes

MongoDB `_id` is the real primary key everywhere.

In API usage:
- session responses usually expose session `_id` as `id`
- `sessionId` in route params refers to the MongoDB session `_id`
- user responses usually expose user `_id` as `id`

Because the project evolved over time:
- newer collections like `sessions`, `recommendationSnapshots`, and `sessionSelections` use `ObjectId`
- `responses` still stores session and user IDs as strings

## Manual Testing Helpers

### Test Google Places API key

```bash
cd backend
node scripts/test-google-places-api.js
```

You can also pass a custom query:

```bash
node scripts/test-google-places-api.js "japanese restaurant auckland cbd"
```

## Additional Documentation

- Recommendation and selection API details: [docs/RECOMMENDATIONS_API.md](docs/RECOMMENDATIONS_API.md)

![Have A Byte](./Have%20A%20Byte.png)
