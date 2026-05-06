# Inventory Management & Billing System

A full-stack POS and inventory management system built with Django REST Framework (backend)
and React + Vite (frontend). Designed for small-to-medium retail businesses.

## Stack

| Part     | Technology                          |
|----------|-------------------------------------|
| Backend  | Python 3.12, Django 5, DRF, PostgreSQL |
| Frontend | React 18, Vite, Ant Design, Zustand |

## Project Structure

```
├── backend/    → Django REST API (runs on port 8000)
└── frontend/   → React SPA (runs on port 5173)
```

## Quick Start

1. Set up and run the backend → see [backend/README.md](./backend/README.md)
2. Set up and run the frontend → see [frontend/README.md](./frontend/README.md)

## Background tasks (Celery, optional)

Invite and password-reset emails can be sent **asynchronously** when `CELERY_BROKER_URL` is set (e.g. Redis). If it is unset, the API sends mail in the same process as the request.

**Start a worker** (from `backend/`, venv active, **Redis running**, and **`CELERY_BROKER_URL`** in `.env`, e.g. `redis://127.0.0.1:6379/0`):

```bash
celery -A config worker -l info
```

See [backend/README.md](./backend/README.md) for environment variables and Docker (the compose files include a `celery` service).

## Requirements

| Tool       | Minimum Version |
|------------|-----------------|
| Python     | 3.12+           |
| Node.js    | 18+             |
| PostgreSQL | 15+             |
| npm        | 9+              |

## Default URLs (Development)

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000/api/v1
- Django Admin: http://localhost:8000/admin
