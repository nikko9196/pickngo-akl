# Have A Byte

Have A Byte is a full-stack web project for CS732. This repository currently contains a React frontend, an Express backend, and a MongoDB Atlas database connection.

## Team Members

- Cheng Cheng (`cche860@aucklanduni.ac.nz`)
- Annie Lin (`yiln996@aucklanduni.ac.nz`)
- Nhu Pham (`dpha478@aucklanduni.ac.nz`)
- Phuong Phan (`ppha961@aucklanduni.ac.nz`)
- Vincent Su (`hsu901@aucklanduni.ac.nz`)
- Cynthia Xie (`zxie211@aucklanduni.ac.nz`)

## 🚀 Getting Started

### Tech Stack

- Frontend: React 19, Vite
- Backend: Node.js, Express 5
- Database: MongoDB Atlas, Mongoose

### Prerequisites

- IDE: Visual Studio Code, WebStorm, or IntelliJ IDEA
- Node.js: v18.x LTS or higher
- npm: v9.x or higher
- MongoDB: Atlas account or another valid MongoDB connection string

Verify installations:

```bash
node -v
npm -v
```

### Installation

#### 1. Clone the Repository

```bash
git clone https://github.com/UOA-CS732-S1-2026/group-project-have-a-byte.git
cd group-project-have-a-byte
```

#### 2. Set Up Backend

```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory:

```env
PORT=5001
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/dbname?retryWrites=true&w=majority
JWT_SECRET=change-this-jwt-secret
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
CLIENT_BASE_URL=http://localhost:5173
```

Variable notes:

- `PORT`: backend development server port
- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: secret used to sign authentication tokens
- `GOOGLE_CLIENT_ID`: required if Google sign-in is enabled
- `CLIENT_BASE_URL`: base frontend URL used to generate session join links

#### 3. Set Up Frontend

```bash
cd ../frontend
npm install
```

Create a `.env` file in the `frontend/` directory:

```env
VITE_PORT=5173
VITE_API_BASE_URL=http://localhost:5001
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

Variable notes:

- `VITE_PORT`: frontend development server port
- `VITE_API_BASE_URL`: backend base URL used by the frontend
- `VITE_GOOGLE_CLIENT_ID`: required if Google sign-in is enabled

### Running the Application

You need two terminal windows to run the current project setup.

#### Terminal 1: Backend Server

```bash
cd backend
npm run dev
```

The backend starts on `http://localhost:5001` by default.

#### Terminal 2: Frontend Server

```bash
cd frontend
npm run dev
```

The frontend development server runs on the port defined by `VITE_PORT`, usually `http://localhost:5173`.

If you change the backend port, update `VITE_API_BASE_URL` in `frontend/.env` to match.

## Project Structure

```text
group-project-have-a-byte/
|-- frontend/                    # React + Vite frontend
|   |-- public/                  # Static assets served directly by Vite
|   |-- src/
|   |   |-- api/                 # API request functions
|   |   |-- assets/              # Images, icons, and static frontend assets
|   |   |-- components/          # Reusable UI components
|   |   |-- context/             # Authentication and shared React context
|   |   |-- pages/               # Page-level React components
|   |   |-- services/            # Frontend service helpers
|   |   |-- utils/               # Frontend helper functions
|   |   |-- App.jsx              # Main frontend app component
|   |   |-- index.css            # Global frontend styles
|   |   |-- main.jsx             # Frontend entry point
|   |-- .env                     # Frontend environment variables
|   |-- eslint.config.js         # Frontend lint configuration
|   |-- package.json             # Frontend scripts and dependencies
|   |-- vite.config.js           # Vite configuration
|-- backend/                     # Node.js + Express backend
|   |-- src/
|   |   |-- config/              # Backend configuration such as MongoDB connection
|   |   |-- controllers/         # Request handlers and business logic
|   |   |-- middleware/          # Express middleware
|   |   |-- models/              # Mongoose models
|   |   |-- routes/              # Express route definitions
|   |   |-- services/            # Reusable backend service logic
|   |   |-- app.js               # Backend entry file
|   |-- .env                     # Backend environment variables
|   |-- package.json             # Backend scripts and dependencies
|-- docs/                        # Supporting project notes and documentation
|-- README.md                    # Setup guide and project overview
```

### Environment Files

- `backend/.env`: backend environment variables such as `PORT`, `MONGODB_URI`, and `JWT_SECRET`
- `frontend/.env`: frontend environment variables such as `VITE_PORT` and `VITE_API_BASE_URL`

### File Naming Conventions

- Use `.jsx` for React files that render JSX
- Use `.js` for non-UI logic files such as API helpers, backend files, and utilities
- Keep React page names descriptive, for example `HomePage.jsx`, `AuthPage.jsx`, and `SessionPage.jsx`
- Keep reusable component names descriptive, for example `Navbar.jsx`, `QuestionCard.jsx`, or `StatusBadge.jsx`
- Keep API/helper filenames action-based, for example `auth.js`, `questions.js`, `sessions.js`, or `formatDate.js`

## 🔌 Current API

Notes:

- `sessionCode` is the public room code used to join or fetch a session
- `sessionId` in API paths refers to the internal MongoDB `_id` of a session
- All routes except registration and login routes require authentication

### Auth

- `POST /api/auth/register`
  - Registers a local user with email and password.
- `POST /api/auth/login`
  - Logs in a local user with email and password.
- `POST /api/auth/google`
  - Logs in a user with Google Sign-In.
- `POST /api/auth/guest`
  - Creates and logs in a guest user.
- `GET /api/auth/me`
  - Returns the currently authenticated user.

### Questions

- `GET /api/questions`
  - Returns the active question lists used in the questionnaire stage.

### Sessions

- `POST /api/sessions`
  - Creates a new session for the host.
- `POST /api/sessions/join`
  - Joins a session using a public `sessionCode`.
- `GET /api/sessions/mine`
  - Returns the sessions the current user belongs to.
- `GET /api/sessions/:sessionCode`
  - Returns session details for a participant using the public room code.
- `GET /api/sessions/:sessionId/progress`
  - Returns questionnaire completion progress for participants in a session.
- `PATCH /api/sessions/:sessionId`
  - Updates session settings such as `maxParticipants`.
- `PATCH /api/sessions/:sessionId/status`
  - Updates the workflow status of a session.
- `DELETE /api/sessions/:sessionId`
  - Deletes a session. Only the host can perform this action.

### User Responses

- `POST /api/sessions/:sessionId/responses`
  - Submits or updates a participant's answer to a question in a session.

## 📦 Database Schema (MongoDB)

This section is intended as a development reference for the current and planned session-driven workflow.

### 🧭 ID Mapping Notes

MongoDB automatically creates an `_id` field for every document. In this project, `_id` is the real database primary key.

When these values are exposed to application code or API responses, they may be mapped to business-friendly names:

- `sessions._id` -> `sessionId` in API path parameters, and currently exposed as `id` in serialized session responses
- `users._id` -> `userId` in participant-related logic, and currently exposed as `id` in serialized user responses
- `responses._id` -> internal response identifier unless a separate response field is introduced later
- `recommendationSets._id` -> recommendation set identifier in future workflow stages
- `userSelections._id` -> selection identifier in future workflow stages
- `wheelRounds._id` -> wheel round identifier in future workflow stages
- `votes._id` -> vote identifier in future workflow stages

Recommendation for ongoing development:

- Keep MongoDB `_id` as the real primary key
- Only introduce custom public identifiers when there is a clear product or integration need

### 1. 🧑‍💻 Users

Collection: `users`

- `_id`: MongoDB primary key
- `displayName`: public name shown to other participants
- `email`: registered email address
- `avatarUrl`: URL to the user's profile picture
- `authProviders`: list of authentication methods
- `isAdmin`: administrative privilege flag
- `lastLoginAt`: last login time
- `createdAt`: creation time
- `updatedAt`: last update time

### 2. ❓ Question Lists

Collection: `questionLists`

- `_id`: MongoDB primary key
- `questionListId`: application-level question list identifier
- `category`: question category
- `isActive`: indicates whether the list is currently active
- `questionList`: list of questions
  - `questionId`
  - `questionType`
  - `questionText`
  - `questionValue`

### 3. 📝 Responses

Collection: `responses`

- `_id`: MongoDB primary key
- `sessionId`: associated session identifier
- `userId`: user who provided the answer
- `questionId`: associated question identifier
- `answer`: submitted answer text
- `skipped`: whether the question was skipped
- `createdAt`: creation time

### 4. 🤖 Recommendation Sets

Collection: `recommendationSets`

- `_id`: MongoDB primary key
- `sessionId`: associated session identifier
- `generatedBy`: AI provider used to create recommendations
- `items`: list of recommended restaurants
- `createdAt`: creation time

### 5. ❤️ User Selections

Collection: `userSelections`

- `_id`: MongoDB primary key
- `sessionId`: associated session identifier
- `userId`: associated user identifier
- `recommendationSetId`: associated recommendation set identifier
- `selectedItems`: shortlisted restaurants
- `createdAt`: creation time

### 6. 🎡 Wheel Rounds

Collection: `wheelRounds`

- `_id`: MongoDB primary key
- `sessionId`: associated session identifier
- `wheelItems`: restaurants included in the wheel round
- `resultPlaceId`: final result restaurant identifier
- `status`: wheel round status
- `createdAt`: creation time

### 7. 🗳️ Votes

Collection: `votes`

- `_id`: MongoDB primary key
- `sessionId`: associated session identifier
- `wheelRoundId`: associated wheel round identifier
- `userId`: associated user identifier
- `vote`: final decision vote
- `createdAt`: creation time

### 8. 🧩 Sessions

Collection: `sessions`

- `_id`: MongoDB primary key
- `hostUserId`: ID of the session creator
- `sessionCode`: unique public room code
- `joinUrl`: direct link used to join the session
- `status`: current workflow state
- `maxParticipants`: participant limit for the session
- `participants`: users currently in the room
  - `userId`
  - `role`
  - `roomDisplayName`
  - `joinedAt`
- `generationList`: history of recommendation sets planned for later workflow stages
- `wheelRoundList`: history of wheel rounds planned for later workflow stages
- `createdAt`: creation time
- `updatedAt`: last update time

![Have A Byte](./Have%20A%20Byte.png)
