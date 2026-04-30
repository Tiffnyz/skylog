import { useState } from "react";
import FilterBar from "./FilterBar";
import StatsPanel from "./StatsPanel";

const API = process.env.REACT_APP_API_URL || "";

export default function ReportModal({ onClose }) {
  const [flights, setFlights] = useState([]);
  const [stats, setStats] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleFilter = async (params) => {
    setLoading(true);
    try {
      const qs = new URLSearchParams(params).toString();
      const res = await fetch(`${API}/api/reports/flights?${qs}`);
      const data = await res.json();
      setFlights(data.flights || []);
      setStats(data.stats || null);
      setLoaded(true);
    } catch {
      console.error("Failed to fetch report");
    }
    setLoading(false);
  };

  const formatDate = (ts) => {
    if (!ts) return "N/A";
    try {
      return new Date(ts).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return ts;
    }
  };

  const statusClass = (status) => {
    if (!status) return "";
    return `status-badge status-${status.toLowerCase().replace(/\s/g, "_")}`;
  };

  const displayCode = (iata, icao) => {
    if (iata) return iata;
    if (!icao) return "?";
    if (icao.length === 4 && icao.startsWith("K")) return icao.slice(1);
    return icao;
  };

  const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : "—";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="report-modal" onClick={(e) => e.stopPropagation()}>
        <div className="report-modal-header">
          <h2>Flight Report</h2>
          <button className="modal-close-btn" onClick={onClose}>✕</button>
        </div>

        <FilterBar onFilter={handleFilter} />

        {loading && <div className="loading">Loading report...</div>}

        {!loading && loaded && (
          <>
            <StatsPanel stats={stats} />
            {flights.length === 0 ? (
              <div className="empty-state">
                <h3>No flights match your filters</h3>
                <p>Try adjusting the date range or removing filters.</p>
              </div>
            ) : (
              <div className="card" style={{ overflow: "auto" }}>
                <table className="flight-table">
                  <thead>
                    <tr>
                      <th>Flight</th>
                      <th>Airline</th>
                      <th>Route</th>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Distance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flights.map((f) => (
                      <tr key={f.flight_id}>
                        <td style={{ fontWeight: 600 }}>{f.flight_number}</td>
                        <td>{f.airline_name || "—"}</td>
                        <td>{displayCode(f.dep_iata, f.dep_icao)} &rarr; {displayCode(f.arr_iata, f.arr_icao)}</td>
                        <td>{formatDate(f.actual_departure || f.scheduled_departure)}</td>
                        <td><span className={statusClass(f.status)}>{capitalize(f.status)}</span></td>
                        <td>{f.distance_miles ? `${Math.round(Number(f.distance_miles)).toLocaleString()} mi` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}

        {!loading && !loaded && (
          <div className="empty-state">
            <h3>Select filters and generate a report</h3>
            <p>Use the filters above to analyze your flight data.</p>
          </div>
        )}
      </div>
    </div>
  );
}
