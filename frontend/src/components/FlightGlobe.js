import { useRef, useEffect, useMemo, useState } from "react";
import Globe from "react-globe.gl";

export default function FlightGlobe({ flights }) {
  const globeRef = useRef();
  const containerRef = useRef();
  const [dims, setDims] = useState({ width: 800, height: window.innerHeight });

  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDims({ width: rect.width, height: rect.height });
      }
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  const arcs = useMemo(() => {
    return flights
      .filter(
        (f) =>
          f.dep_lat != null &&
          f.dep_lon != null &&
          f.arr_lat != null &&
          f.arr_lon != null
      )
      .map((f) => ({
        startLat: parseFloat(f.dep_lat),
        startLng: parseFloat(f.dep_lon),
        endLat: parseFloat(f.arr_lat),
        endLng: parseFloat(f.arr_lon),
        label: `${f.flight_number}: ${f.dep_iata || f.dep_icao || "?"} → ${f.arr_iata || f.arr_icao || "?"}`,
      }));
  }, [flights]);

  const points = useMemo(() => {
    const airportMap = {};
    flights.forEach((f) => {
      const addAirport = (lat, lon, iata, icao, name, city, flightNum, role) => {
        if (lat == null || lon == null) return;
        const key = `${lat},${lon}`;
        if (!airportMap[key]) {
          airportMap[key] = {
            lat: parseFloat(lat),
            lng: parseFloat(lon),
            code: iata || icao || "?",
            name: name || iata || icao || "",
            city: city || "",
            flights: [],
          };
        }
        airportMap[key].flights.push(`${flightNum} (${role})`);
      };
      addAirport(f.dep_lat, f.dep_lon, f.dep_iata, f.dep_icao, f.dep_name, f.dep_city, f.flight_number, "dep");
      addAirport(f.arr_lat, f.arr_lon, f.arr_iata, f.arr_icao, f.arr_name, f.arr_city, f.flight_number, "arr");
    });
    return Object.values(airportMap);
  }, [flights]);

  useEffect(() => {
    if (globeRef.current) {
      globeRef.current.controls().autoRotate = true;
      globeRef.current.controls().autoRotateSpeed = 0.5;
      globeRef.current.pointOfView({ lat: 30, lng: -60, altitude: 1.8 }, 0);
    }
  }, []);

  return (
    <div ref={containerRef} style={{ width: "100%", height: "100%" }}>
    <Globe
      ref={globeRef}
      width={dims.width}
      height={dims.height}
      backgroundColor="rgba(0,0,0,0)"
      globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
      bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
      arcsData={arcs}
      arcStartLat="startLat"
      arcStartLng="startLng"
      arcEndLat="endLat"
      arcEndLng="endLng"
      arcColor={() => ["rgba(58,184,232,1)", "rgba(56,239,192,1)"]}
      arcAltitudeAutoScale={0.35}
      arcStroke={0.25}
      arcDashLength={0.5}
      arcDashGap={0.2}
      arcDashAnimateTime={1800}
      arcLabel="label"
      htmlElementsData={points}
      htmlLat="lat"
      htmlLng="lng"
      htmlAltitude={0.01}
      htmlLabel={(d) =>
        `<div style="background:rgba(5,8,20,0.85);border:1px solid rgba(58,184,232,0.4);border-radius:8px;padding:8px 12px;font-family:'Space Grotesk',sans-serif;font-size:13px;color:#e0e0f0;pointer-events:none;white-space:nowrap;">
          <div style="font-weight:700;color:#3ab8e8;margin-bottom:4px;">${d.code}${d.city ? ` · ${d.city}` : ""}</div>
          ${d.name ? `<div style="color:#8aabb8;font-size:11px;margin-bottom:5px;">${d.name}</div>` : ""}
          ${d.flights.map(fl => `<div style="font-size:12px;color:#c0d8e0;">✈ ${fl}</div>`).join("")}
        </div>`
      }
      htmlElement={(d) => {
        const el = document.createElement("div");
        el.style.cssText = `
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: rgba(58, 184, 232, 0.9);
          box-shadow: 0 0 6px 3px rgba(58, 184, 232, 0.6), 0 0 12px 6px rgba(56, 239, 192, 0.2);
          cursor: pointer;
          pointer-events: auto;
        `;
        return el;
      }}
      atmosphereColor="#4a80ff"
      atmosphereAltitude={0.15}
    />
    </div>
  );
}
