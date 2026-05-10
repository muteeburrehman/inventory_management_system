"""Django project package.

Eagerly import the Celery application so ``@shared_task`` in worker and web processes
binds to the same ``ims`` app (broker from Django settings). Lazy-loading ``config.app``
broke dispatch from runserver: ``.delay()`` used Celery's default app, not ``config.celery``.
"""

from .celery import app as celery_app

app = celery_app

__all__ = ("app", "celery_app")
