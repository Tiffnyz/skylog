import { useState, useEffect, useCallback } from "react";
import AddFlightModal from "../components/AddFlightModal";
import FlightGlobe from "../components/FlightGlobe";
import ReportModal from "../components/ReportModal";

const API = process.env.REACT_APP_API_URL || "";

export default function MyFlights() {
  const [flights, setFlights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null);
  const [editStatus, setEditStatus] = useState("");

  const fetchFlights = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/flights`);
      const data = await res.json();
      setFlights(data.flights || []);
    } catch {
      console.error("Failed to fetch flights");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFlights();
  }, [fetchFlights]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await fetch(`${API}/api/flights/${deleteTarget}`, { method: "DELETE" });
      fetchFlights();
    } catch {
      console.error("Failed to delete");
    }
    setDeleteTarget(null);
  };

  const handleEdit = async () => {
    if (!editTarget) return;
    try {
      await fetch(`${API}/api/flights/${editTarget}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: editStatus }),
      });
      fetchFlights();
    } catch {
      console.error("Failed to update");
    }
    setEditTarget(null);
  };

  const formatDate = (ts) => {
    if (!ts) return "N/A";
    try {
      return new Date(ts).toLocaleDateString([], {
        month: "short", day: "numeric", year: "numeric",
      });
    } catch {
      return ts;
    }
  };

  const statusClass = (status) => {
    if (!status) return "";
    const s = status.toLowerCase().replace(/\s/g, "_");
    return `status-badge status-${s}`;
  };

  const displayCode = (iata, icao) => {
    if (iata) return iata;
    if (!icao) return "?";
    if (icao.length === 4 && icao.startsWith("K")) return icao.slice(1);
    return icao;
  };

  const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : "—";

  if (loading) return <div className="loading">Loading flights...</div>;

  return (
    <div className="flights-layout">
      {/* Left: Globe */}
      <div className="globe-panel">
        <FlightGlobe flights={flights} />
      </div>

      {/* Right: Flight list */}
      <div className="flights-panel">
        <div className="page-header">
          <h1>My Flights</h1>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setShowReportModal(true)}>
              Report
            </button>
            <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
              + Add Flight
            </button>
          </div>
        </div>

        {flights.length === 0 ? (
          <div className="empty-state">
            <h3>No flights yet</h3>
            <p>Search and add your first flight to get started.</p>
          </div>
        ) : (
          <div className="flight-cards-list">
            {flights.map((f) => (
              <div key={f.flight_id} className="flight-card-item">
                <div className="flight-card-top">
                  <span className="flight-card-number">{f.flight_number}</span>
                  <span className={statusClass(f.status)}>{capitalize(f.status)}</span>
                </div>
                <div className="flight-card-route">
                  {displayCode(f.dep_iata, f.dep_icao)} &rarr; {displayCode(f.arr_iata, f.arr_icao)}
                </div>
                <div className="flight-card-meta">
                  <span>{f.airline_name || "—"}</span>
                  <span>{formatDate(f.actual_departure || f.scheduled_departure)}</span>
                  {f.distance_miles && (
                    <span>{Math.round(Number(f.distance_miles)).toLocaleString()} mi</span>
                  )}
                </div>
                <div className="flight-card-actions">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => { setEditTarget(f.flight_id); setEditStatus(f.status || ""); }}
                  >
                    Edit
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => setDeleteTarget(f.flight_id)}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddModal && (
        <AddFlightModal
          onClose={() => setShowAddModal(false)}
          onAdded={fetchFlights}
        />
      )}

      {showReportModal && (
        <ReportModal onClose={() => setShowReportModal(false)} />
      )}

      {deleteTarget && (
        <div className="confirm-overlay">
          <div className="confirm-dialog">
            <p>Are you sure you want to delete this flight?</p>
            <button className="btn btn-danger" onClick={handleDelete}>Delete</button>
            <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
          </div>
        </div>
      )}

      {editTarget && (
        <div className="modal-overlay" onClick={() => setEditTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
            <h2>Edit Flight</h2>
            <div className="form-group">
              <label>Status</label>
              <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}>
                <option value="scheduled">Scheduled</option>
                <option value="in_air">In Air</option>
                <option value="landed">Landed</option>
                <option value="cancelled">Cancelled</option>
                <option value="diverted">Diverted</option>
              </select>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setEditTarget(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleEdit}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
