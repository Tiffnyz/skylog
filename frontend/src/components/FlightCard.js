export default function FlightCard({ flight, onEdit, onDelete }) {
  const formatDate = (ts) => {
    if (!ts) return "N/A";
    try {
      return new Date(ts).toLocaleDateString([], {
        month: "short", day: "numeric", year: "numeric"
      });
    } catch {
      return ts;
    }
  };

  const delayDisplay = (minutes) => {
    if (minutes === null || minutes === undefined) return "N/A";
    if (minutes <= 0) return <span className="delay-zero">On time</span>;
    return <span className="delay-positive">+{minutes} min</span>;
  };

  return null; // We use a table row instead — see MyFlights.js
}
