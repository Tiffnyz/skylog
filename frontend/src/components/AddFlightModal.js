import { useState } from "react";

const API = "http://127.0.0.1:5000";

export default function AddFlightModal({ onClose, onAdded }) {
  const [flightNumber, setFlightNumber] = useState("");
  const [date, setDate] = useState("");
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async () => {
    if (!flightNumber || !date) return;
    setSearching(true);
    setError("");
    setResults(null);

    try {
      const res = await fetch(
        `${API}/api/search-flights?flight_number=${encodeURIComponent(flightNumber)}&date=${date}`
      );
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else if (!data.flights || data.flights.length === 0) {
        setError("No flights found for that number and date.");
      } else {
        setResults(data.flights);
      }
    } catch {
      setError("Failed to search. Check that the backend is running.");
    }
    setSearching(false);
  };

  const handleAdd = async (flight) => {
    setAdding(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/flights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(flight),
      });
      const data = await res.json();
      if (res.ok) {
        onAdded();
        onClose();
      } else {
        setError(data.error || "Failed to add flight");
      }
    } catch {
      setError("Failed to add flight.");
    }
    setAdding(false);
  };

  const formatTime = (ts) => {
    if (!ts) return "N/A";
    try {
      return new Date(ts).toLocaleString([], {
        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
      });
    } catch {
      return ts;
    }
  };

  const displayCode = (iata, icao) => {
    if (iata) return iata;
    if (!icao) return "?";
    if (icao.length === 4 && icao.startsWith("K")) return icao.slice(1);
    return icao;
  };

  const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Add Flight</h2>

        <div className="form-row">
          <div className="form-group">
            <label>Flight Number</label>
            <input
              type="text"
              placeholder="e.g. DL460"
              value={flightNumber}
              onChange={(e) => setFlightNumber(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <div className="form-group">
            <label>Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
        </div>

        <button
          className="btn btn-primary"
          onClick={handleSearch}
          disabled={searching || !flightNumber || !date}
          style={{ marginBottom: 16 }}
        >
          {searching ? "Searching..." : "Search"}
        </button>

        {error && <p className="error-msg">{error}</p>}

        {results && results.map((flight, i) => (
          <div key={flight.fr24_id || i} className="search-result-card">
            <div className="search-result-route">
              {displayCode(flight.orig_iata, flight.orig_icao)} &rarr; {displayCode(flight.dest_iata, flight.dest_icao)}
            </div>
            <div className="search-result-details">
              <span>{flight.flight_number}</span>
              <span>{flight.airline_icao || ""}</span>
              <span>Departed: {formatTime(flight.actual_departure)}</span>
              <span>Arrived: {formatTime(flight.actual_arrival)}</span>
              <span>{capitalize(flight.status)}</span>
              {flight.distance && <span>{Math.round(flight.distance).toLocaleString()} km</span>}
              <span>{flight.aircraft_type || ""}</span>
            </div>
            <button
              className="btn btn-primary btn-sm"
              style={{ marginTop: 10 }}
              onClick={() => handleAdd(flight)}
              disabled={adding}
            >
              {adding ? "Adding..." : "Add This Flight"}
            </button>
          </div>
        ))}

        <div style={{ marginTop: 16, textAlign: "right" }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
