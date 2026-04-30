import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navbar from "./components/Navbar";
import MyFlights from "./pages/MyFlights";
import StarField from "./components/StarField";
import "./App.css";

function App() {
  return (
    <Router>
      <StarField />
      <Navbar />
      <div className="app-container">
        <Routes>
          <Route path="/" element={<MyFlights />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
