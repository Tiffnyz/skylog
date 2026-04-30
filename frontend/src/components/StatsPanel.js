export default function StatsPanel({ stats }) {
  if (!stats) return null;

  const items = [
    { label: "Total Flights", value: stats.total_flights || 0 },
    { label: "Total Miles", value: Math.round(stats.total_miles || 0).toLocaleString() },
    { label: "Avg Distance", value: `${Math.round(stats.avg_distance || 0).toLocaleString()} mi` },
    { label: "Unique Airports", value: stats.unique_airports || 0 },
    { label: "Unique Airlines", value: stats.unique_airlines || 0 },
  ];

  return (
    <div className="stats-grid">
      {items.map((item) => (
        <div className="stat-card" key={item.label}>
          <div className="stat-value">{item.value}</div>
          <div className="stat-label">{item.label}</div>
        </div>
      ))}
    </div>
  );
}
