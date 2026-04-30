CREATE TABLE IF NOT EXISTS airlines (
    airline_id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    iata_code VARCHAR(10),
    icao_code VARCHAR(10),
    UNIQUE(iata_code),
    UNIQUE(icao_code)
);

CREATE TABLE IF NOT EXISTS airports (
    airport_id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    city VARCHAR(255),
    country VARCHAR(255),
    iata_code VARCHAR(10),
    icao_code VARCHAR(10),
    latitude NUMERIC,
    longitude NUMERIC,
    UNIQUE(iata_code),
    UNIQUE(icao_code)
);

CREATE TABLE IF NOT EXISTS flights (
    flight_id SERIAL PRIMARY KEY,
    fr24_id VARCHAR(255) UNIQUE,
    flight_number VARCHAR(20) NOT NULL,
    airline_id INTEGER REFERENCES airlines(airline_id),
    departure_airport_id INTEGER REFERENCES airports(airport_id),
    arrival_airport_id INTEGER REFERENCES airports(airport_id),
    scheduled_departure TIMESTAMP,
    scheduled_arrival TIMESTAMP,
    actual_departure TIMESTAMP,
    actual_arrival TIMESTAMP,
    departure_delay INTEGER,
    arrival_delay INTEGER,
    status VARCHAR(50),
    distance_miles NUMERIC,
    aircraft_type VARCHAR(50),
    aircraft_registration VARCHAR(20),
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flights_actual_departure_desc
    ON flights (actual_departure DESC);

CREATE INDEX IF NOT EXISTS idx_flights_airline_actual_departure_desc
    ON flights (airline_id, actual_departure DESC);

CREATE INDEX IF NOT EXISTS idx_flights_departure_airport_actual_departure_desc
    ON flights (departure_airport_id, actual_departure DESC);

CREATE INDEX IF NOT EXISTS idx_flights_arrival_airport_actual_departure_desc
    ON flights (arrival_airport_id, actual_departure DESC);
