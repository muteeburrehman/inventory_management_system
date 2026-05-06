# Backend — Django REST API

## Tech Stack

- Python 3.12
- Django 5.x + Django REST Framework
- PostgreSQL 15 (or SQLite via `USE_SQLITE=true` in `.env` for quick local runs)
- JWT Auth (djangorestframework-simplejwt)
- django-cors-headers, django-filter, python-decouple, Pillow

## Troubleshooting

**`password authentication failed for user "postgres"`** — Your `DB_PASSWORD` in `.env` does not match PostgreSQL. Either set the correct password (and ensure `CREATE DATABASE inventory_db` exists), or set **`USE_SQLITE=true`** in `.env` to use `backend/db.sqlite3` for local development (no PostgreSQL).

## Prerequisites

- Python 3.12+ (`python --version`)
- PostgreSQL 15+ installed and running (unless using SQLite)
- `pip` available

## Setup

### Step 1 — Navigate to backend folder

```bash
cd backend
```

### Step 2 — Create and activate virtual environment

```bash
python -m venv venv
source venv/bin/activate
```

### Step 3 — Install dependencies

```bash
pip install -r requirements.txt
```

### Step 4 — Configure environment

```bash
cp .env.example .env
```

Fill in `SECRET_KEY`, database credentials, and optionally set `USE_SQLITE=true` for a zero-config database file (`db.sqlite3`).

### Step 5 — Run migrations

```bash
python manage.py migrate
```

### Step 6 — Create admin superuser

```bash
python manage.py createsuperuser
```

### Step 7 — Start development server

```bash
python manage.py runserver
```

Backend: **http://localhost:8000** — API prefix: **http://localhost:8000/api/v1/**

## Celery (async email)

Password-reset and user-invitation emails can be queued on **Celery** when **`CELERY_BROKER_URL`** is set (typically pointing at Redis). If **`CELERY_BROKER_URL`** is empty, the same code sends email **synchronously** inside the web process (no worker needed).

### Local development

1. Run **Redis** (example): `redis-server` or Docker: `docker run -d -p 6379:6379 redis:7-alpine`
2. In `backend/.env`, set for example:
   - `CELERY_BROKER_URL=redis://127.0.0.1:6379/0`
   - Ensure **real SMTP** is configured if you expect mail in an inbox (see `.env.example`); `console` backend only prints to the terminal.
3. In a **second terminal** (venv active, `cd backend`), with **`CELERY_BROKER_URL`** set in `.env` (see below):

```bash
celery -A config worker -l info
```

You **must** set a broker URL or the worker will exit with instructions. Typical local Redis:

```env
CELERY_BROKER_URL=redis://127.0.0.1:6379/0
```

Optional concurrency: `celery -A config worker -l info --concurrency=2`

### Docker Compose

`docker-compose.yml` and `docker-compose.full-stack.yml` define a **`celery`** service and **`redis`**. After `docker compose up`, the worker starts automatically. Set **`EMAIL_*`** and **`FRONTEND_BASE_URL`** in your `.env` so messages are delivered and links are correct.

## URLs

| URL | Description |
|-----|-------------|
| `http://localhost:8000/api/v1/` | REST API base |
| `http://localhost:8000/admin/` | Django admin |
| `http://localhost:8000/api/v1/auth/login/` | JWT login |

## Folder Structure

```
backend/
├── config/               # Project settings, URLs, WSGI
├── apps/                 # Domain apps (accounts, products, sales, …)
├── media/                # Uploads (gitignored)
├── manage.py
├── requirements.txt
├── .env                  # Local secrets — do not commit
└── .env.example          # Template — safe to commit
```

## Notes

- API responses use `{ "success", "data", "message" }` (envelope renderer).
- `DJANGO_SETTINGS_MODULE` defaults to `config.settings.development` in `manage.py`.
- Never commit `.env`.
