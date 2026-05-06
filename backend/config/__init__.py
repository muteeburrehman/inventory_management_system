def __getattr__(name):
    if name in ("app", "celery_app"):
        from .celery import app as celery_application

        return celery_application
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = ("app", "celery_app")
