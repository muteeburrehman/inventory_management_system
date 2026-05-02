from decouple import Csv, config

from .base import *  # noqa: F401,F403

DEBUG = False
ALLOWED_HOSTS = config("ALLOWED_HOSTS", cast=Csv())

# Static files for Docker / reverse-proxy setups (no separate nginx location for /static/)
MIDDLEWARE = list(MIDDLEWARE)
MIDDLEWARE.insert(1, "whitenoise.middleware.WhiteNoiseMiddleware")
STATICFILES_STORAGE = "whitenoise.storage.CompressedStaticFilesStorage"

# Serve uploaded media from Django when True (small deployments; use CDN or nginx alias later)
SERVE_MEDIA = config("SERVE_MEDIA", default=False, cast=bool)

# Behind nginx-proxy / Traefik (TLS terminated at proxy)
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_X_FORWARDED_HOST = True

_csrf_raw = config("CSRF_TRUSTED_ORIGINS", default="", cast=Csv())
CSRF_TRUSTED_ORIGINS = [x.strip() for x in (_csrf_raw or []) if x and str(x).strip()]
