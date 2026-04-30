import os
import airportsdata
import requests as http_requests
from datetime import datetime, timedelta
from flask import Flask, jsonify, request
from flask_cors import CORS
from sqlalchemy import create_engine, text
from dotenv import load_dotenv

_AIRPORTS_ICAO = airportsdata.load("ICAO")
_AIRPORTS_IATA = airportsdata.load("IATA")

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

app = Flask(__name__)
CORS(app)

_db_url = os.getenv("DATABASE_URL", "postgresql://localhost/cs348")
if _db_url.startswith("postgres://"):
    _db_url = _db_url.replace("postgres://", "postgresql://", 1)
engine = create_engine(_db_url)

FR24_API_TOKEN = os.getenv("FR24_API_TOKEN")
FR24_BASE_URL = "https://fr24api.flightradar24.com"


# --------------- FR24 API Proxy ---------------

@app.route("/api/search-flights")
def search_flights():
    flight_number = request.args.get("flight_number", "").strip().upper()
    date_str = request.args.get("date", "").strip()

    if not flight_number or not date_str:
        return jsonify(error="flight_number and date are required"), 400

    try:
        date_obj = datetime.strptime(date_str, "%Y-%m-%d")
    except ValueError:
        return jsonify(error="Invalid date format. Use YYYY-MM-DD"), 400

    dt_from = date_obj.strftime("%Y-%m-%dT00:00:00Z")
    dt_to = (date_obj + timedelta(days=1)).strftime("%Y-%m-%dT00:00:00Z")

    headers = {
        "Authorization": f"Bearer {FR24_API_TOKEN}",
        "Accept": "application/json",
        "Accept-Version": "v1",
    }

    try:
        resp = http_requests.get(
            f"{FR24_BASE_URL}/api/flight-summary/full",
            params={
                "flights": flight_number,
                "flight_datetime_from": dt_from,
                "flight_datetime_to": dt_to,
            },
            headers=headers,
            timeout=15,
        )

        if resp.status_code == 401:
            return jsonify(error="FR24 API authentication failed"), 401
        if resp.status_code == 404:
            return jsonify(flights=[])
        resp.raise_for_status()

        data = resp.json()
        raw_flights = data.get("data", [])

        # Normalize the FR24 full response into a consistent shape for the frontend
        flights = []
        for f in raw_flights:
            flights.append({
                "fr24_id": f.get("fr24_id", ""),
                "flight_number": f.get("flight", ""),
                "callsign": f.get("callsign", ""),
                "airline_icao": f.get("operating_as", "") or f.get("painted_as", ""),
                "orig_iata": f.get("orig_iata", ""),
                "orig_icao": f.get("orig_icao", ""),
                "dest_iata": f.get("dest_iata", ""),
                "dest_icao": f.get("dest_icao", ""),
                "actual_departure": f.get("datetime_takeoff"),
                "actual_arrival": f.get("datetime_landed"),
                "flight_time": f.get("flight_time"),
                "distance": f.get("actual_distance"),
                "status": "landed" if f.get("flight_ended") else "in_air",
                "aircraft_type": f.get("type", ""),
                "aircraft_registration": f.get("reg", ""),
                "category": f.get("category", ""),
            })

        return jsonify(flights=flights)
    except http_requests.RequestException as e:
        return jsonify(error=f"FR24 API error: {str(e)}"), 502


# --------------- CRUD: Flights ---------------

@app.route("/api/flights", methods=["GET"])
def get_flights():
    with engine.connect() as conn:
        rows = conn.execute(text("""
            SELECT f.flight_id, f.fr24_id, f.flight_number,
                   al.name AS airline_name, al.icao_code AS airline_icao,
                   dep.iata_code AS dep_iata, dep.icao_code AS dep_icao, dep.name AS dep_name, dep.city AS dep_city,
                   dep.latitude AS dep_lat, dep.longitude AS dep_lon,
                   arr.iata_code AS arr_iata, arr.icao_code AS arr_icao, arr.name AS arr_name, arr.city AS arr_city,
                   arr.latitude AS arr_lat, arr.longitude AS arr_lon,
                   f.scheduled_departure, f.scheduled_arrival,
                   f.actual_departure, f.actual_arrival,
                   f.departure_delay, f.arrival_delay,
                   f.status, f.distance_miles,
                   f.aircraft_type, f.aircraft_registration,
                   f.created_at
            FROM flights f
            LEFT JOIN airlines al ON f.airline_id = al.airline_id
            LEFT JOIN airports dep ON f.departure_airport_id = dep.airport_id
            LEFT JOIN airports arr ON f.arrival_airport_id = arr.airport_id
            ORDER BY f.actual_departure DESC NULLS LAST
        """)).mappings().all()

        flights = [dict(r) for r in rows]
        for f in flights:
            for k, v in f.items():
                if isinstance(v, datetime):
                    f[k] = v.isoformat()
        return jsonify(flights=flights)


@app.route("/api/flights", methods=["POST"])
def add_flight():
    data = request.get_json()
    if not data:
        return jsonify(error="No data provided"), 400

    try:
        with engine.begin() as conn:
            # Upsert airline by ICAO code
            airline_icao = (data.get("airline_icao") or "").strip()
            airline_id = None
            if airline_icao:
                conn.execute(text("""
                    INSERT INTO airlines (name, icao_code)
                    VALUES (:name, :icao)
                    ON CONFLICT (icao_code) DO NOTHING
                """), {"name": airline_icao, "icao": airline_icao})

                row = conn.execute(text(
                    "SELECT airline_id FROM airlines WHERE icao_code = :icao"
                ), {"icao": airline_icao}).mappings().first()
                if row:
                    airline_id = row["airline_id"]

            # Upsert departure airport
            dep_airport_id = _upsert_airport(conn,
                icao=data.get("orig_icao", ""),
                iata=data.get("orig_iata", ""))

            # Upsert arrival airport
            arr_airport_id = _upsert_airport(conn,
                icao=data.get("dest_icao", ""),
                iata=data.get("dest_iata", ""))

            # Parse times
            actual_dep = _parse_ts(data.get("actual_departure"))
            actual_arr = _parse_ts(data.get("actual_arrival"))

            fr24_id = data.get("fr24_id", "")
            flight_number = data.get("flight_number", "")
            status = data.get("status", "")
            distance = data.get("distance")
            aircraft_type = data.get("aircraft_type", "")
            aircraft_reg = data.get("aircraft_registration", "")

            row = conn.execute(text("""
                INSERT INTO flights (
                    fr24_id, flight_number, airline_id,
                    departure_airport_id, arrival_airport_id,
                    actual_departure, actual_arrival,
                    status, distance_miles,
                    aircraft_type, aircraft_registration
                ) VALUES (
                    :fr24_id, :flight_number, :airline_id,
                    :dep_id, :arr_id,
                    :actual_dep, :actual_arr,
                    :status, :distance,
                    :aircraft_type, :aircraft_reg
                )
                RETURNING flight_id
            """), {
                "fr24_id": fr24_id,
                "flight_number": flight_number,
                "airline_id": airline_id,
                "dep_id": dep_airport_id,
                "arr_id": arr_airport_id,
                "actual_dep": actual_dep,
                "actual_arr": actual_arr,
                "status": status,
                "distance": distance,
                "aircraft_type": aircraft_type,
                "aircraft_reg": aircraft_reg,
            }).mappings().first()

            return jsonify(flight_id=row["flight_id"], message="Flight added"), 201

    except Exception as e:
        error_msg = str(e)
        if "unique" in error_msg.lower() or "duplicate" in error_msg.lower():
            return jsonify(error="This flight has already been added"), 409
        return jsonify(error=error_msg), 500


@app.route("/api/flights/<int:flight_id>", methods=["PUT"])
def update_flight(flight_id):
    data = request.get_json()
    if not data:
        return jsonify(error="No data provided"), 400

    allowed = ["status", "actual_departure", "actual_arrival"]
    sets = []
    params = {"flight_id": flight_id}

    for field in allowed:
        if field in data:
            sets.append(f"{field} = :{field}")
            params[field] = data[field]

    if not sets:
        return jsonify(error="No valid fields to update"), 400

    query = f"UPDATE flights SET {', '.join(sets)} WHERE flight_id = :flight_id"

    with engine.begin() as conn:
        result = conn.execute(text(query), params)
        if result.rowcount == 0:
            return jsonify(error="Flight not found"), 404
        return jsonify(message="Flight updated")


@app.route("/api/flights/<int:flight_id>", methods=["DELETE"])
def delete_flight(flight_id):
    with engine.begin() as conn:
        result = conn.execute(
            text("DELETE FROM flights WHERE flight_id = :id"),
            {"id": flight_id}
        )
        if result.rowcount == 0:
            return jsonify(error="Flight not found"), 404
        return jsonify(message="Flight deleted")


# --------------- Dynamic Data ---------------

@app.route("/api/airlines")
def get_airlines():
    with engine.connect() as conn:
        rows = conn.execute(text(
            "SELECT airline_id, name, iata_code, icao_code FROM airlines ORDER BY name"
        )).mappings().all()
        return jsonify(airlines=[dict(r) for r in rows])


@app.route("/api/airports")
def get_airports():
    with engine.connect() as conn:
        rows = conn.execute(text(
            "SELECT airport_id, name, city, country, iata_code, icao_code FROM airports ORDER BY name"
        )).mappings().all()
        return jsonify(airports=[dict(r) for r in rows])


# --------------- Report ---------------

@app.route("/api/reports/flights")
def flight_report():
    filters = []
    params = {}

    from_date = request.args.get("from_date")
    to_date = request.args.get("to_date")
    airline_id = request.args.get("airline_id")
    dep_airport_id = request.args.get("departure_airport_id")
    arr_airport_id = request.args.get("arrival_airport_id")

    if from_date:
        filters.append("f.actual_departure >= :from_date")
        params["from_date"] = from_date
    if to_date:
        filters.append("f.actual_departure <= :to_date")
        params["to_date"] = to_date
    if airline_id:
        filters.append("f.airline_id = :airline_id")
        params["airline_id"] = int(airline_id)
    if dep_airport_id:
        filters.append("f.departure_airport_id = :dep_airport_id")
        params["dep_airport_id"] = int(dep_airport_id)
    if arr_airport_id:
        filters.append("f.arrival_airport_id = :arr_airport_id")
        params["arr_airport_id"] = int(arr_airport_id)

    where = ""
    if filters:
        where = "WHERE " + " AND ".join(filters)

    with engine.connect() as conn:
        # Flights list
        rows = conn.execute(text(f"""
            SELECT f.flight_id, f.fr24_id, f.flight_number,
                   al.name AS airline_name, al.icao_code AS airline_icao,
                   dep.iata_code AS dep_iata, dep.icao_code AS dep_icao, dep.name AS dep_name, dep.city AS dep_city,
                   dep.latitude AS dep_lat, dep.longitude AS dep_lon,
                   arr.iata_code AS arr_iata, arr.icao_code AS arr_icao, arr.name AS arr_name, arr.city AS arr_city,
                   arr.latitude AS arr_lat, arr.longitude AS arr_lon,
                   f.scheduled_departure, f.scheduled_arrival,
                   f.actual_departure, f.actual_arrival,
                   f.departure_delay, f.arrival_delay,
                   f.status, f.distance_miles,
                   f.aircraft_type, f.aircraft_registration
            FROM flights f
            LEFT JOIN airlines al ON f.airline_id = al.airline_id
            LEFT JOIN airports dep ON f.departure_airport_id = dep.airport_id
            LEFT JOIN airports arr ON f.arrival_airport_id = arr.airport_id
            {where}
            ORDER BY f.actual_departure DESC NULLS LAST
        """), params).mappings().all()

        flights = [dict(r) for r in rows]
        for f in flights:
            for k, v in f.items():
                if isinstance(v, datetime):
                    f[k] = v.isoformat()

        # Stats
        stats_row = conn.execute(text(f"""
            SELECT
                COUNT(*) AS total_flights,
                COALESCE(SUM(f.distance_miles), 0) AS total_miles,
                COUNT(DISTINCT f.airline_id) AS unique_airlines,
                COALESCE(AVG(f.distance_miles), 0) AS avg_distance
            FROM flights f
            {where}
        """), params).mappings().first()

        # Unique airports (union of departure and arrival)
        dep_where = "WHERE f.departure_airport_id IS NOT NULL"
        arr_where = "WHERE f.arrival_airport_id IS NOT NULL"
        if filters:
            dep_where += " AND " + " AND ".join(filters)
            arr_where += " AND " + " AND ".join(filters)

        unique_airports_row = conn.execute(text(f"""
            SELECT COUNT(*) AS unique_airports FROM (
                SELECT f.departure_airport_id AS airport_id FROM flights f {dep_where}
                UNION
                SELECT f.arrival_airport_id AS airport_id FROM flights f {arr_where}
            ) AS all_airports
        """), {**params, **params}).mappings().first()

        stats = dict(stats_row)
        stats["unique_airports"] = unique_airports_row["unique_airports"]
        # Convert Decimal types to float for JSON
        for k, v in stats.items():
            if v is not None and not isinstance(v, (int, float, str)):
                stats[k] = float(v)

        return jsonify(flights=flights, stats=stats)


# --------------- Helpers ---------------

def _upsert_airport(conn, icao="", iata=""):
    """Upsert an airport using its ICAO code, storing IATA and coordinates if available."""
    icao = (icao or "").strip()
    iata = (iata or "").strip()
    if not icao:
        return None

    info = _AIRPORTS_ICAO.get(icao) or (iata and _AIRPORTS_IATA.get(iata)) or {}
    lat = info.get("lat")
    lon = info.get("lon")
    name = info.get("name") or iata or icao
    resolved_iata = info.get("iata") or iata

    conn.execute(text("""
        INSERT INTO airports (name, icao_code, iata_code, latitude, longitude)
        VALUES (:name, :icao, NULLIF(:iata, ''), :lat, :lon)
        ON CONFLICT (icao_code) DO UPDATE SET
            iata_code = COALESCE(NULLIF(EXCLUDED.iata_code, ''), airports.iata_code),
            latitude  = COALESCE(EXCLUDED.latitude,  airports.latitude),
            longitude = COALESCE(EXCLUDED.longitude, airports.longitude),
            name      = COALESCE(NULLIF(EXCLUDED.name, ''), airports.name)
    """), {"name": name, "icao": icao, "iata": resolved_iata, "lat": lat, "lon": lon})

    row = conn.execute(text(
        "SELECT airport_id FROM airports WHERE icao_code = :icao"
    ), {"icao": icao}).mappings().first()
    return row["airport_id"] if row else None


@app.route("/api/backfill-airports", methods=["POST"])
def backfill_airports():
    """Backfill lat/lon for airports that are missing coordinates."""
    with engine.begin() as conn:
        rows = conn.execute(text(
            "SELECT airport_id, icao_code, iata_code FROM airports WHERE latitude IS NULL"
        )).mappings().all()
        updated = 0
        for row in rows:
            icao = row["icao_code"] or ""
            iata = row["iata_code"] or ""
            info = _AIRPORTS_ICAO.get(icao) or (iata and _AIRPORTS_IATA.get(iata)) or {}
            if info.get("lat") is not None:
                conn.execute(text("""
                    UPDATE airports SET latitude = :lat, longitude = :lon,
                        name = COALESCE(NULLIF(name, :icao), name)
                    WHERE airport_id = :aid
                """), {"lat": info["lat"], "lon": info["lon"], "icao": icao, "aid": row["airport_id"]})
                updated += 1
    return jsonify(updated=updated)


def _parse_ts(val):
    if not val:
        return None
    if isinstance(val, datetime):
        return val
    try:
        val = val.replace("Z", "+00:00")
        return datetime.fromisoformat(val)
    except (ValueError, AttributeError):
        return None


if __name__ == "__main__":
    app.run(debug=True)
