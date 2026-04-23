# ELD Trip Planner — Django + React

A full-stack application that plans property-carrier trucking trips under
the FMCSA **70-hour / 8-day** Hours-of-Service rules. It takes a driver's
current location, pickup and drop-off addresses, and cycle hours already
used — and produces:

1. An interactive map showing the route plus all required rest, break and
   fuel stops.
2. Automatically drawn **Driver's Daily Log** sheets (one per 24-hour
   period) rendered in the FMCSA grid layout.
3. A timeline of every duty-status change with timestamps and locations.

Built with **Django 5 + Django REST Framework** (backend) and **React 18 +
Vite + TypeScript + Leaflet** (frontend). Uses the free **OpenStreetMap Nominatim**
API for geocoding and **OpenRouteService** for routing — no paid map API keys
required.

---

## Features

- ✅ Handles the full set of FMCSA HOS rules for property carriers
  - 11-hour driving limit within a 14-hour on-duty window (§ 395.3(a))
  - Mandatory 30-minute break after 8 cumulative driving hours (§ 395.3(a)(3)(ii))
  - 10-consecutive-hour off-duty reset between shifts
  - 70-hour / 8-day cycle with **34-hour restart** when the limit is hit
- ✅ Fuel stops every 1,000 miles (15 min on-duty not driving)
- ✅ 1 hour on-duty at pickup and drop-off
- ✅ Multi-day trips split across as many log sheets as required
- ✅ Beautiful, responsive dark UI
- ✅ Auto-drawn ELD grid with proper vertical connectors at every duty-status change
- ✅ Persisted trip history via Django ORM

---

## Repository layout

```
.
├── backend/                 Django + DRF project
│   ├── eld_project/         Settings / URLs / WSGI
│   ├── trips/
│   │   ├── services/
│   │   │   ├── geocoding.py   # Nominatim client (rate-limited)
│   │   │   ├── routing.py     # OpenRouteService client
│   │   │   └── hos_simulator.py  # FMCSA-rules simulator (see below)
│   │   ├── views.py         # REST API
│   │   ├── serializers.py
│   │   ├── models.py
│   │   └── urls.py
│   ├── requirements.txt
│   ├── render.yaml          # 1-click Render blueprint
│   ├── Procfile
│   └── runtime.txt
└── frontend/                React + Vite + TypeScript app
    ├── src/
    │   ├── components/
    │   │   ├── TripForm.tsx
    │   │   ├── MapView.tsx
    │   │   ├── TripSummary.tsx
    │   │   ├── StopsList.tsx
    │   │   └── LogSheet.tsx  # FMCSA-style ELD grid (SVG)
    │   ├── api.ts
    │   ├── App.tsx
    │   ├── main.tsx
    │   ├── types.ts          # Shared Plan / Stop / Event types
    │   └── vite-env.d.ts
    ├── tsconfig.json
    ├── tsconfig.node.json
    ├── vite.config.ts        # proxies /api to the Django dev server
    └── vercel.json
```

---

## Local development

### 1) Backend

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1       # Windows
# source .venv/bin/activate        # macOS / Linux
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

The API will be available at `http://127.0.0.1:8000/api/`. The key
endpoint is:

```
POST /api/plan-trip/
{
  "current_location": "Chicago, IL",
  "pickup_location":  "Dallas, TX",
  "dropoff_location": "Miami, FL",
  "current_cycle_used_hours": 10,
  "start_time": "2026-04-23T06:00:00Z"   // optional
}
```

### 2) Frontend

```powershell
cd frontend
npm install
npm run dev
```

Open <http://localhost:5173>. Vite proxies `/api/*` to `127.0.0.1:8000`,
so no CORS setup is required locally.

---

## Deployment

The assessment suggested Vercel. The cleanest split is:

- **Frontend → Vercel** (static site from `frontend/`)
- **Backend → Render / Railway / Fly.io** (Django + gunicorn)

### Frontend on Vercel

1. Push the repo to GitHub.
2. On Vercel, click **New Project → Import** your repo and pick the
   `frontend/` directory as the project root.
3. Framework preset: **Vite**. Build command: `npm run build`. Output
   directory: `dist`.
4. Add an environment variable `VITE_API_BASE` set to your backend URL
   (e.g. `https://your-backend.onrender.com`).
5. Deploy.

`frontend/vercel.json` is already included.

### Backend on Render (1-click)

1. Push the repo to GitHub.
2. In Render, choose **New → Blueprint** and point it at the repo. The
   `backend/render.yaml` defines the service.
3. Once deployed, copy the public URL and set `VITE_API_BASE` on the
   Vercel project to that URL.
4. Optionally harden CORS by setting `CORS_ALLOWED_ORIGINS` (comma
   separated) to your Vercel URL on Render's env settings and removing
   `CORS_ALLOW_ALL_ORIGINS`.

Alternatively the project is configured for:
- **Railway / Fly.io** → use the `Procfile`.
- **Docker / VPS** → `gunicorn eld_project.wsgi:application` behind any
  reverse proxy.

---

## How the HOS simulator works

`backend/trips/services/hos_simulator.py` is the brain of the
application. It consumes the two physical route legs (current → pickup
and pickup → drop-off) produced by OpenRouteService and walks forward in time,
emitting a chronological list of events:

```json
{
  "status": "driving",
  "start": "2026-04-23T06:00:00+00:00",
  "end":   "2026-04-23T14:00:00+00:00",
  "duration_hours": 8.0,
  "miles": 510.3,
  "start_coord": [-87.63, 41.88],
  "end_coord":   [-92.41, 37.12],
  "start_location": "Chicago, IL",
  "end_location":   "En route",
  "note": "Driving 510.3 mi"
}
```

At every tick the simulator computes how long the driver can legally
drive next by taking the minimum of:

| Limit                             | Source                           |
| --------------------------------- | -------------------------------- |
| Hours remaining to the 11-hr max  | § 395.3(a)(3)                    |
| Hours remaining to the 14-hr max  | § 395.3(a)(2)                    |
| Hours before the 30-min break     | § 395.3(a)(3)(ii)                |
| Hours remaining in the 70-hr cycle| § 395.3(b) — 70 hr / 8 days      |
| Hours remaining in this leg       | route distance / avg speed       |
| Miles to the next fuel stop       | project assumption (every 1000mi)|

If any limit is reached, the simulator inserts the appropriate rest
event (30-minute break, 10-hour off-duty reset, or 34-hour restart) and
continues. Geographic interpolation along the OpenRouteService polyline is done with
a haversine walk so every stop has real coordinates for the map.

The resulting events are then split on 24-hour boundaries and grouped
into daily logs for rendering.

The module has no Django dependencies (it only uses `datetime` and
`math`) and is unit-testable; see `backend/test_sim.py` for a quick
smoke test.

---

## API reference

| Method | Path                    | Description                                   |
| ------ | ----------------------- | --------------------------------------------- |
| POST   | `/api/plan-trip/`       | Full trip plan (geocode + route + HOS sim)    |
| POST   | `/api/geocode/`         | Thin Nominatim wrapper                        |
| GET    | `/api/trips/`           | List previously planned trips                 |
| GET    | `/api/trips/<id>/`      | Retrieve a saved trip                         |
| GET    | `/`                     | Health check                                  |

---

## Assumptions (from the assessment)

- Property-carrying driver on the **70 hr / 8 day** schedule.
- No adverse driving conditions (§ 395.1(b)(1) not used).
- Fueling at least once every **1,000 miles** (15 min on-duty not
  driving).
- **1 hour** on-duty not driving for pickup and drop-off each.
- Driver starts the trip legally rested (10 consecutive hours off duty
  already completed), with the provided cycle hours already accumulated
  against the 70-hour limit.

---

## Credits

Built around the FMCSA's _Interstate Truck Driver's Guide to Hours of
Service_ (April 2022 edition), 49 CFR Part 395. Maps by
OpenStreetMap contributors, routing by
[OpenRouteService](https://openrouteservice.org/), geocoding by
[Nominatim](https://nominatim.openstreetmap.org).
