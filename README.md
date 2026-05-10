# ELD Trip Planner

A full-stack FMCSA-compliant Electronic Logging Device (ELD) trip planner. Enter an origin, pickup, and dropoff location along with your current cycle hours, and the app generates an HOS-compliant route with annotated stops and daily log sheets.

**Live demo:** https://eld-trip-planner-ashy.vercel.app  
**Backend API:** https://eld-planner.duckdns.org/graphql/

---

## Features

- HOS rules engine — 11-hr driving limit, 14-hr duty window, 30-min break at 8 hrs, 10-hr rest, 70-hr/8-day cycle
- Interactive Leaflet map with color-coded stop markers
- FMCSA-style daily log sheets rendered on HTML Canvas
- GraphQL API (GraphiQL explorer available at `/graphql/`)
- Mobile-responsive layout

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Apollo Client, React-Leaflet, Tailwind v4 |
| Backend | Django 5, Graphene-Django (GraphQL), Daphne (ASGI) |
| Routing | OpenRouteService API + Nominatim geocoding |
| Deployment | Vercel (frontend), Oracle Cloud VM + Docker + Nginx (backend) |

---

## Project Structure

```
eld-trip-planner/
├── frontend/          # React app (deployed to Vercel)
└── backend/           # Django app (deployed via Docker on OCI VM)
```

---

## Local Development

### Prerequisites

- Python 3.11+
- Node.js 18+
- An [OpenRouteService API key](https://openrouteservice.org/)

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

cp .env.example .env
# Fill in ORS_API_KEY and SECRET_KEY

python manage.py migrate
python manage.py runserver
```

GraphiQL explorer: http://localhost:8000/graphql/

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:5173

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description |
|---|---|
| `SECRET_KEY` | Django secret key |
| `DEBUG` | `True` for development, `False` for production |
| `ALLOWED_HOSTS` | Comma-separated list of allowed hostnames |
| `CORS_ALLOWED_ORIGINS` | Comma-separated list of allowed frontend origins |
| `ORS_API_KEY` | OpenRouteService API key |
| `DATABASE_URL` | Optional — defaults to SQLite if not set |

### Frontend (`frontend/.env`)

| Variable | Description |
|---|---|
| `VITE_GRAPHQL_URL` | GraphQL endpoint URL (defaults to `http://localhost:8000/graphql/`) |

---

## Running Tests

```bash
cd backend
python manage.py test trips.tests
```

Test coverage includes HOS engine rules: driving limits, break triggers, fuel stops, rest stops, and 24-hour daily log totals.

---

## Deployment

### Backend (Docker on OCI VM)

Push to `main` — GitHub Actions builds the Docker image and restarts the container on the self-hosted runner.

Required GitHub secrets: `SECRET_KEY`, `DEBUG`, `ALLOWED_HOSTS`, `CORS_ALLOWED_ORIGINS`, `ORS_API_KEY`

### Frontend (Vercel)

Vercel auto-deploys on push to `main`. Set `VITE_GRAPHQL_URL` in Vercel project environment variables.
