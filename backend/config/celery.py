"""Celery application for IMS.

Imported from ``config/__init__.py`` so runserver and workers share one ``Celery("ims")``
and Django ``CELERY_*`` settings (including ``CELERY_BROKER_URL``).

If ``CELERY_BROKER_URL`` is empty, avoid calling ``.delay()`` (see ``accounts.mail``).
"""

import os
import sys
from pathlib import Path

# The ``celery`` CLI is not ``python manage.py``; ensure project root is on sys.path.
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

import django
from celery import Celery
from django.conf import settings

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")
if not settings.configured:
    django.setup()

app = Celery("ims")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()
