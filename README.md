# SkyLog ✈

A personal flight tracker that lets you log flights from your travel history, visualize them on an interactive 3D globe, and run reports over your data.

## Features

- **3D Interactive Globe** — animated flight path arcs and glowing airport dots powered by `react-globe.gl`, rendered over a live star field background
- **Live Flight Search** — search real flights by number and date via the FlightRadar24 API
- **Flight Log** — add, edit, and delete flights; airport coordinates are automatically resolved and stored
- **Reports** — filter your flight history by date range, airline, and airport with aggregate stats (total miles, unique airports, etc.)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React, react-globe.gl |
| Backend | Python, Flask, SQLAlchemy |
| Database | PostgreSQL |
| Flight Data | FlightRadar24 API |
| Airport Data | `airportsdata` package |

## Project Structure

```
cs348-project/
├── backend/
│   ├── app.py          # Flask REST API
│   ├── schema.sql      # PostgreSQL schema and indexes
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── components/ # Navbar, Globe, Modals, FilterBar, etc.
│       └── pages/      # MyFlights
└── .env                # Not committed — see setup below
```

## Setup

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL running locally with a database named `cs348`
- A [FlightRadar24 API](https://fr24api.flightradar24.com) token

### 1. Environment Variables

Create a `.env` file in the project root:

```
FR24_API_TOKEN=your_token_here
```

### 2. Database

```bash
psql cs348 < backend/schema.sql
```

### 3. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate      # Windows: venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

The API will be available at `http://127.0.0.1:5000`.

### 4. Frontend

```bash
cd frontend
npm install
npm start
```

The app will open at `http://localhost:3000`.

### 5. Backfill Airport Coordinates (first run)

If you have existing flights in the database whose airports are missing coordinates, run:

```bash
curl -X POST http://127.0.0.1:5000/api/backfill-airports
```

This resolves latitude/longitude for all airports using the bundled `airportsdata` dataset.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/flights` | List all saved flights |
| POST | `/api/flights` | Add a flight |
| PUT | `/api/flights/<id>` | Update a flight's status |
| DELETE | `/api/flights/<id>` | Delete a flight |
| GET | `/api/search-flights` | Search live flights via FR24 |
| GET | `/api/reports/flights` | Filtered flight report with stats |
| GET | `/api/airlines` | List all airlines |
| GET | `/api/airports` | List all airports |
| POST | `/api/backfill-airports` | Backfill airport coordinates |
