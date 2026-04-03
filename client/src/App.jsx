import { BrowserRouter, Route, Routes } from "react-router-dom";

import { AuthProvider } from "./context/AuthContext";
import AuthPage from "./pages/AuthPage";
import HomePage from "./pages/HomePage";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth" element={<AuthPage />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
