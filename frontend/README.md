# Frontend — React + Vite SPA

## Tech Stack

- React 18 + Vite
- React Router v6
- Ant Design
- Zustand + TanStack React Query
- Axios (JWT refresh)
- Recharts, react-zxing, react-to-print, JsBarcode, xlsx, jspdf

## Prerequisites

- Node.js 18+ and npm 9+

## Setup

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

App: **http://localhost:5173**

Default `.env` uses `VITE_API_BASE_URL=/api/v1` with the Vite dev proxy to `http://127.0.0.1:8000` (see `vite.config.js`). Point to a full URL if you prefer CORS from the Django backend.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Dev server |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview production build |

## Routes (initial)

- `/login` — login
- `/` — dashboard
- `/pos` — POS / billing

## Auth

Tokens are stored under keys from `.env` (`VITE_ACCESS_TOKEN_KEY`, `VITE_REFRESH_TOKEN_KEY`). Axios attaches `Authorization` and refreshes on `401` via `/auth/refresh/`.
