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
