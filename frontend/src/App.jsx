import { BrowserRouter, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import Wheelpage from "./pages/Wheelpage";
import ResultPage from "./pages/ResultPage";

function App() {
  return (
    <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/wheel/session/:sessionid" element={<Wheelpage />} />
          <Route path="/result/session/:sessionid" element={<ResultPage />} />
        </Routes>
      {/* </div> */}
    </BrowserRouter>
  );
}

export default App;