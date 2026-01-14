import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from "./components/Home";
import TextModifier from "./components/TextModifier";
import NSLookup from "./components/NSLookup";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/kelime" element={<TextModifier />} />
        <Route path="/ns" element={<NSLookup />} />
      </Routes>
    </Router>
  );
}

export default App;
