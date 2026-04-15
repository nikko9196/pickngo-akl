# Have A Byte Frontend

This branch contains the frontend for the CS732 Have A Byte project. The app is built with React and Vite and covers the main room, sign-in, session, and question flows.

## Team Members

- Cheng Cheng (`cche860@aucklanduni.ac.nz`)
- Annie Lin (`yiln996@aucklanduni.ac.nz`)
- Nhu Pham (`dpha478@aucklanduni.ac.nz`)
- Phuong Phan (`ppha961@aucklanduni.ac.nz`)
- Vincent Su (`hsu901@aucklanduni.ac.nz`)
- Cynthia Xie (`zxie211@aucklanduni.ac.nz`)

## Tech Stack

- React 19
- Vite
- React Router
- Axios

## Prerequisites

- Node.js 18+
- npm 9+

Check your versions:

```bash
node -v
npm -v
```

## Getting Started

Install dependencies from the frontend directory:

```bash
cd frontend
npm install
```

Create `frontend/.env` if needed:

```env
VITE_PORT=5173
VITE_API_BASE_URL=http://localhost:5001
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
```

Variable notes:

- `VITE_PORT`: local dev server port
- `VITE_API_BASE_URL`: backend base URL used by frontend API calls
- `VITE_GOOGLE_CLIENT_ID`: Google sign-in client id

Start the development server:

```bash
cd frontend
npm run dev
```

By default the app runs at `http://localhost:5173`.

## Project Structure

```text
group-project-have-a-byte/
|-- frontend/
|   |-- public/                  # Static files served by Vite
|   |-- src/
|   |   |-- api/                 # Frontend API request helpers
|   |   |-- assets/              # Images, icons, and design assets
|   |   |-- components/          # Reusable UI components
|   |   |-- context/             # Shared React context
|   |   |-- pages/               # Page-level screens
|   |   |-- services/            # Frontend service helpers
|   |   |-- utils/               # Utility helpers
|   |   |-- App.jsx              # Route configuration
|   |   |-- index.css            # Global styles
|   |   |-- main.jsx             # App entry point
|   |-- index.html
|   |-- package.json
|   |-- vite.config.js
|-- README.md
```

## Available Pages

- `/` home page
- `/auth` sign-in and authentication page
- `/rooms/create` room creation page
- `/join` room join page
- `/join/:sessionCode` join page with a prefilled room code
- `/sessions/:sessionCode` session page
- `/sessions/:sessionCode/question` question flow page

## Notes

- This README only documents the frontend in this branch.
- If `VITE_API_BASE_URL` is unavailable, API-backed features will not work locally.
