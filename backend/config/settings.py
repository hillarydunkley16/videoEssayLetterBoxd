"""
Django settings for the csv_movie_downloader backend (Django 5.2 LTS).

Environment-driven: with no env vars set this runs as a local dev server
(DEBUG on, SQLite, permissive CORS). Production values — DJANGO_DEBUG,
DJANGO_SECRET_KEY, DJANGO_ALLOWED_HOSTS, DJANGO_CSRF_TRUSTED_ORIGINS,
CORS_ALLOWED_ORIGINS, DATABASE_URL, CLERK_ISSUER — come from the environment.
See backend/.env.example and DEPLOY.md.

https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/
"""

from pathlib import Path
import os
from datetime import timedelta

BASE_DIR = Path(__file__).resolve().parent.parent


def _env_bool(name, default=False):
    raw = os.environ.get(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _env_list(name):
    return [item.strip() for item in os.environ.get(name, "").split(",") if item.strip()]


# DJANGO_DEBUG wins when set. Otherwise: on for zero-config local dev, but off
# as soon as a real DJANGO_SECRET_KEY is present (i.e. someone configured this
# for deployment).
DEBUG = _env_bool(
    "DJANGO_DEBUG", default=not os.environ.get("DJANGO_SECRET_KEY")
)

# SECURITY WARNING: real key must come from the environment in production.
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY")
if not SECRET_KEY:
    if DEBUG:
        SECRET_KEY = "django-insecure-local-dev-only-do-not-use-in-production"
    else:
        raise RuntimeError("DJANGO_SECRET_KEY must be set when DJANGO_DEBUG is off")

ALLOWED_HOSTS = _env_list("DJANGO_ALLOWED_HOSTS") or (["*"] if DEBUG else [])
CSRF_TRUSTED_ORIGINS = _env_list("DJANGO_CSRF_TRUSTED_ORIGINS")



# Application definition

INSTALLED_APPS = [
    'movie_csv',
    'users.apps.UsersConfig',
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Legacy Django-template web UI packages (bootstrap5 / star_ratings / crispy)
    # removed: the deployed backend serves the DRF API + admin only; the Expo web
    # app is the frontend. Legacy templates/views under movie_csv/ remain on disk
    # but are no longer mounted (see movie_csv/urls/__init__.py).
    # 'serpapi' / 'dotenv' were never real Django apps — imported directly in code.
    'django_otp',
    'django_otp.plugins.otp_totp',
    'django_otp.plugins.otp_email',  
    'rest_framework', 
    'rest_framework_simplejwt',
    'rest_framework.authtoken',
    # "typomatic",
    'corsheaders',
    # 'two_factor',
    
]

MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.security.SecurityMiddleware',
    # WhiteNoise is inserted here in Task 6.
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
    'django_otp.middleware.OTPMiddleware',
]

ROOT_URLCONF = 'config.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'config.wsgi.application'

# --- CORS -----------------------------------------------------------------
# Wide open in local dev; an explicit allowlist (CORS_ALLOWED_ORIGINS, comma
# separated) in production.
CORS_ALLOW_ALL_ORIGINS = DEBUG
CORS_ALLOWED_ORIGINS = _env_list("CORS_ALLOWED_ORIGINS")
CORS_ALLOW_HEADERS = ["authorization", "content-type"]

# --- Production security -------------------------------------------------
# Only engaged when DEBUG is off, so local dev over http is unaffected.
if not DEBUG:
    SECURE_SSL_REDIRECT = _env_bool("DJANGO_SECURE_SSL_REDIRECT", default=True)
    # Render terminates TLS at its proxy and forwards this header.
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_HSTS_SECONDS = int(os.environ.get("DJANGO_SECURE_HSTS_SECONDS", "3600"))
    SECURE_HSTS_INCLUDE_SUBDOMAINS = SECURE_HSTS_SECONDS > 0
    SECURE_HSTS_PRELOAD = SECURE_HSTS_SECONDS > 0

# --- Database -----------------------------------------------------------
# dj-database-url wiring lands in Task 6; SQLite stays the local default.
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'db.sqlite3',
    }
}


# Password validation
# https://docs.djangoproject.com/en/4.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]

STATICFILES_DIRS = [
    BASE_DIR / "movie_csv" / "static",
]

# LOGIN_REDIRECT_URL
# LOGIN_URL = 'two_factor:login'
# LOGIN_REDIRECT_URL = 'two_factor:profile' 
LOGIN_REDIRECT_URL = "/admin/"
LOGOUT_REDIRECT_URL = "/admin/"
LOGIN_URL = "/admin/login/"
# Internationalization
# https://docs.djangoproject.com/en/4.2/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/4.2/howto/static-files/

STATIC_URL = '/static/'

# Default primary key field type
# https://docs.djangoproject.com/en/4.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'

MEDIA_ROOT = os.path.join(BASE_DIR, 'media') # Directory where uploaded media is saved.
MEDIA_URL = '/media/' # Public URL at the browser

# tutorial/settings.py
REST_FRAMEWORK = {
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 10,
    'DEFAULT_AUTHENTICATION_CLASSES': (
        
        "movie_csv.authentication.ClerkAuthentication",
        # 'rest_framework_simplejwt.authentication.JWTAuthentication',
        'rest_framework.authentication.SessionAuthentication',
        'rest_framework.authentication.TokenAuthentication',
       
        
        
    #    "rest_framework.authentication.BasicAuthentication",
    ),
    'DEFAULT_PERMISSION_CLASSES': [
       
        'rest_framework.permissions.IsAuthenticated',
    ],

}
# --- Clerk auth -------------------------------------------------------
# Production must supply CLERK_ISSUER; local dev falls back to the dev instance.
# CLERK_ISSUER_LEGACY optionally accepts tokens from a second issuer during a
# dev -> prod cutover (consumed in movie_csv/authentication.py — Task 7).
CLERK_ISSUER = os.environ.get("CLERK_ISSUER") or (
    "https://splendid-sunbird-55.clerk.accounts.dev" if DEBUG else None
)
if not CLERK_ISSUER:
    raise RuntimeError("CLERK_ISSUER must be set when DJANGO_DEBUG is off")
CLERK_ISSUER = CLERK_ISSUER.rstrip("/")
CLERK_JWKS_URL = f"{CLERK_ISSUER}/.well-known/jwks.json"
CLERK_ISSUER_LEGACY = (os.environ.get("CLERK_ISSUER_LEGACY") or "").rstrip("/")


SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(minutes=60),
    'SLIDING_TOKEN_REFRESH_LIFETIME': timedelta(days=1),
    'SLIDING_TOKEN_LIFETIME': timedelta(days=30),
    'SLIDING_TOKEN_REFRESH_LIFETIME_LATE_USER': timedelta(days=1),
    'SLIDING_TOKEN_LIFETIME_LATE_USER': timedelta(days=30),
}