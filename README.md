# QNSC Knowledge Base Frontend

React + TypeScript + Vite + TailwindCSS application for QNSC Knowledge Base.

## Run it locally

You need Node.js 20 or newer and a running backend. The backend is
[`qnsc-kb-backend`](https://github.com/quynhonsemiconductor/qnsc-kb-backend): its README has the
five commands that start it (Postgres, Redis, API, worker, beat) from a clean clone, and no API keys.

```bash
git clone https://github.com/quynhonsemiconductor/qnsc-kb-frontend.git
cd qnsc-kb-frontend
cp .env.example .env          # optional; the defaults below are what it contains
npm ci
npm run dev                   # http://localhost:5173
```

Open <http://localhost:5173> and sign in with the backend's bootstrap administrator:

| | |
|---|---|
| Email | `admin@qnsc.vn` |
| Password | `Admin123@` (a published development default; the backend refuses it in production) |

For more accounts, the backend README shows how to seed the Admin, CEO, Reviewer and Staff test users.

### How it reaches the API

`VITE_API_BASE_URL=/api/v1` is a relative path, so the browser calls the dev server and the dev
server proxies `/api` to `http://localhost:8000` (the backend's default port). That means no CORS
and same-origin cookies. To use a backend somewhere else, set `VITE_DEV_API_TARGET` in `.env` and
restart `npm run dev`. If the backend's port had to change (`KB_API_PORT` in its `.env`), set
`VITE_DEV_API_TARGET=http://localhost:<port>` to match.

An absolute `VITE_API_BASE_URL` skips the proxy and calls the backend cross-origin; that only works
from an origin its `CORS_ORIGINS` lists, which is `http://localhost:5173` by default. A production
build (`npm run build`) refuses to compile without `VITE_API_BASE_URL`.

The dev port is pinned to 5173 (`FRONTEND_DEV_PORT` in `.env` to change it). If it is taken, `npm run dev` fails with
`Port 5173 is already in use` rather than moving: the backend's CORS and the sign-in cookie are set for this origin.

### Run a second copy

Beside a second copy of the backend (its own `COMPOSE_PROJECT_NAME` and `KB_API_PORT`, see its README), this copy needs
its own dev port and proxy target. In `.env`: `FRONTEND_DEV_PORT=5174` and `VITE_DEV_API_TARGET=http://localhost:<that backend's KB_API_PORT>`.
Then `npm run dev` and sign in as before.

### Checks

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```
