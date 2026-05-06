"""Celery application.

Requires ``CELERY_BROKER_URL`` in Django settings (e.g. ``redis://127.0.0.1:6379/0``).
If it is unset, do not start this worker — the API will send email synchronously instead.
"""

import os
import sys
from pathlib import Path

# The `celery` CLI is not run as `python manage.py`, so Python may not have `backend/` on sys.path.
# Without this, ``import apps.*`` from INSTALLED_APPS fails with ModuleNotFoundError: No module named 'apps'.
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

import django
from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
django.setup()

from django.conf import settings

broker = (getattr(settings, "CELERY_BROKER_URL", None) or "").strip()
if not broker:
    print(
        "CELERY_BROKER_URL is empty. Celery was trying RabbitMQ (amqp://127.0.0.1:5672) by default.\n\n"
        "Fix: add to backend/.env, start Redis, then run the worker again:\n"
        "  CELERY_BROKER_URL=redis://127.0.0.1:6379/0\n\n"
        "Leave CELERY_BROKER_URL unset if you do not use a worker (emails are sent inline).",
        file=sys.stderr,
    )
    sys.exit(1)

app = Celery("ims")
app.config_from_object("django.conf:settings", namespace="CELERY")
# Empty broker in env makes config_from_object set broker_url falsy; Celery then defaults to AMQP.
app.conf.broker_url = broker
app.conf.broker_connection_retry_on_startup = True
app.autodiscover_tasks()
