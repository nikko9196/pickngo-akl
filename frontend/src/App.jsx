import { BrowserRouter, Route, Routes } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import AuthPage from "./pages/AuthPage";
import CreateRoomPage from "./pages/CreateRoomPage";
import HomePage from "./pages/HomePage";
import JoinRoomPage from "./pages/JoinRoomPage";
import QuestionPage from "./pages/QuestionPage";
import SessionPage from "./pages/SessionPage";

import RecommendationPage from "./pages/RecommendationPage";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/rooms/create" element={<CreateRoomPage />} />
          <Route path="/join" element={<JoinRoomPage />} />
          <Route path="/join/:sessionCode" element={<JoinRoomPage />} />
          <Route path="/sessions/:sessionCode" element={<SessionPage />} />
          <Route path="/sessions/:sessionCode/question" element={<QuestionPage />} />

          <Route path="/sessions/:sessionCode/recommendation" element={<RecommendationPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
