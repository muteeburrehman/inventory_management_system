import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.development")

application = get_wsgi_application()

# Ensures the WSGI process loads the Celery app (same as ``config.__init__`` at import); harmless if redundant.
import config.celery  # noqa: E402, F401
