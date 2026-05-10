from pathlib import Path
from datetime import timedelta

from decouple import Config, Csv, RepositoryEmpty, RepositoryEnv

BASE_DIR = Path(__file__).resolve().parent.parent.parent
# Always load backend/.env (not cwd / AutoConfig heuristics). Celery and runserver then match.
_env_path = BASE_DIR / ".env"
_config_repository = (
    RepositoryEnv(str(_env_path))
    if _env_path.is_file()
    else RepositoryEmpty()
)
config = Config(_config_repository)

SECRET_KEY = config("SECRET_KEY")
DEBUG = config("DEBUG", default=False, cast=bool)
ALLOWED_HOSTS = config("ALLOWED_HOSTS", default="localhost,127.0.0.1", cast=Csv())

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt",
    "corsheaders",
    "django_filters",
    "apps.accounts",
    "apps.settings_app",
    "apps.products",
    "apps.suppliers",
    "apps.customers",
    "apps.purchases",
    "apps.sales",
    "apps.inventory",
    "apps.barcodes",
    "apps.ledger",
    "apps.expenses",
    "apps.reports",
    "apps.notifications",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "apps.accounts.must_change_mw.MustChangePasswordMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
    "apps.accounts.middleware.AuditLogMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = config("STATIC_URL", default="/static/")
STATIC_ROOT = BASE_DIR / config("STATIC_ROOT", default="staticfiles")

MEDIA_URL = config("MEDIA_URL", default="/media/")
MEDIA_ROOT = BASE_DIR / config("MEDIA_ROOT", default="media")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "accounts.User"

AUTHENTICATION_BACKENDS = [
    "apps.accounts.backends.EmailOrUsernameModelBackend",
    "django.contrib.auth.backends.ModelBackend",
]

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": config("DB_NAME"),
        "USER": config("DB_USER"),
        "PASSWORD": config("DB_PASSWORD"),
        "HOST": config("DB_HOST", default="localhost"),
        "PORT": config("DB_PORT", default="5432"),
    }
}

REDIS_URL = config("REDIS_URL", default="")
MAX_ACTIVE_REFRESH_SESSIONS = config("MAX_ACTIVE_REFRESH_SESSIONS", default=10, cast=int)
FRONTEND_BASE_URL = config("FRONTEND_BASE_URL", default="http://localhost:5173").rstrip("/")
INVITE_LINK_VALID_HOURS = config("INVITE_LINK_VALID_HOURS", default=72, cast=int)
PASSWORD_RESET_VALID_SECONDS = config("PASSWORD_RESET_VALID_SECONDS", default=3600, cast=int)
ENABLE_LOGIN_OTP = config("ENABLE_LOGIN_OTP", default=False, cast=bool)
DEFAULT_FROM_EMAIL = config("DEFAULT_FROM_EMAIL", default="noreply@localhost")
# SMTP (read in development and production). Console backend ignores these; without them,
# Django falls back to localhost:25 and SMTP fails with connection refused.
EMAIL_HOST = config("EMAIL_HOST", default="")
EMAIL_PORT = config("EMAIL_PORT", default=587, cast=int)
EMAIL_USE_TLS = config("EMAIL_USE_TLS", default=True, cast=bool)
EMAIL_HOST_USER = config("EMAIL_HOST_USER", default="")
EMAIL_HOST_PASSWORD = config("EMAIL_HOST_PASSWORD", default="")
IMS_APP_NAME = config("IMS_APP_NAME", default="Inventory Management System")

# If empty, the API sends transactional email synchronously (no queue). The worker requires
# CELERY_BROKER_URL to be set — see config/celery.py.
CELERY_BROKER_URL = config("CELERY_BROKER_URL", default="").strip()
CELERY_RESULT_BACKEND = config("CELERY_RESULT_BACKEND", default="").strip() or None
CELERY_ACCEPT_CONTENT = ["json"]
CELERY_TASK_SERIALIZER = "json"
CELERY_RESULT_SERIALIZER = "json"
CELERY_TIMEZONE = TIME_ZONE
CELERY_BROKER_CONNECTION_RETRY_ON_STARTUP = True

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "apps.accounts.authentication.IMSJWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": ("rest_framework.permissions.IsAuthenticated",),
    "DEFAULT_RENDERER_CLASSES": ("config.renderers.EnvelopeJSONRenderer",),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_PAGINATION_CLASS": "config.pagination.IMSPageNumberPagination",
    "PAGE_SIZE": 25,
    "EXCEPTION_HANDLER": "config.exceptions.custom_exception_handler",
}

ACCESS_MINUTES = config("ACCESS_TOKEN_LIFETIME_MINUTES", default=60, cast=int)
REFRESH_DAYS = config("REFRESH_TOKEN_LIFETIME_DAYS", default=7, cast=int)

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=ACCESS_MINUTES),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=REFRESH_DAYS),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": False,
    # Avoid extra DB write on login (also rules out rare last_login migration issues).
    "UPDATE_LAST_LOGIN": False,
}

REFRESH_TOKEN_LIFETIME_SEC = int(SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"].total_seconds())
ACCESS_TOKEN_LIFETIME_SEC = int(SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"].total_seconds())

CORS_ALLOWED_ORIGINS = config(
    "CORS_ALLOWED_ORIGINS",
    default="http://localhost:5173,http://127.0.0.1:5173",
    cast=Csv(),
)

DEFAULT_CURRENCY = config("DEFAULT_CURRENCY", default="PKR")
LOW_STOCK_THRESHOLD = config("LOW_STOCK_THRESHOLD", default=10, cast=int)
