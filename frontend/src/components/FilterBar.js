import { useState, useEffect } from "react";

const API = "http://127.0.0.1:5000";

export default function FilterBar({ onFilter }) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [airlineId, setAirlineId] = useState("");
  const [depAirportId, setDepAirportId] = useState("");
  const [arrAirportId, setArrAirportId] = useState("");
  const [airlines, setAirlines] = useState([]);
  const [airports, setAirports] = useState([]);

  useEffect(() => {
    fetch(`${API}/api/airlines`).then(r => r.json()).then(d => setAirlines(d.airlines || [])).catch(() => {});
    fetch(`${API}/api/airports`).then(r => r.json()).then(d => setAirports(d.airports || [])).catch(() => {});
  }, []);

  const handleSubmit = () => {
    const params = {};
    if (fromDate) params.from_date = fromDate;
    if (toDate) params.to_date = toDate;
    if (airlineId) params.airline_id = airlineId;
    if (depAirportId) params.departure_airport_id = depAirportId;
    if (arrAirportId) params.arrival_airport_id = arrAirportId;
    onFilter(params);
  };

  return (
    <div className="filter-bar">
      <div className="form-group">
        <label>From Date</label>
        <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
      </div>
      <div className="form-group">
        <label>To Date</label>
        <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
      </div>
      <div className="form-group">
        <label>Airline</label>
        <select value={airlineId} onChange={e => setAirlineId(e.target.value)}>
          <option value="">All Airlines</option>
          {airlines.map(a => (
            <option key={a.airline_id} value={a.airline_id}>
              {a.name} ({a.icao_code || a.iata_code})
            </option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>Departure Airport</label>
        <select value={depAirportId} onChange={e => setDepAirportId(e.target.value)}>
          <option value="">All Airports</option>
          {airports.map(a => (
            <option key={a.airport_id} value={a.airport_id}>
              {a.icao_code || a.iata_code} - {a.city || a.name}
            </option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label>Arrival Airport</label>
        <select value={arrAirportId} onChange={e => setArrAirportId(e.target.value)}>
          <option value="">All Airports</option>
          {airports.map(a => (
            <option key={a.airport_id} value={a.airport_id}>
              {a.icao_code || a.iata_code} - {a.city || a.name}
            </option>
          ))}
        </select>
      </div>
      <button className="btn btn-primary" onClick={handleSubmit}>
        Generate Report
      </button>
    </div>
  );
}
