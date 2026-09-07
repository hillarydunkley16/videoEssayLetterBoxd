"""Deployment-readiness tests for config/settings.py.

These run the real settings module in a subprocess with a controlled
environment, so they exercise the same code path Render will.
"""
import os
import subprocess
import sys
from pathlib import Path

from django.test import SimpleTestCase

BACKEND_DIR = Path(__file__).resolve().parent.parent
MANAGE = BACKEND_DIR / "manage.py"

# Env vars settings.py reads — stripped from the inherited environment so each
# test starts from a known-empty baseline and only sees what it injects.
_SETTINGS_ENV_KEYS = {
    "DJANGO_DEBUG",
    "DJANGO_SECRET_KEY",
    "DJANGO_ALLOWED_HOSTS",
    "DJANGO_CSRF_TRUSTED_ORIGINS",
    "DJANGO_SECURE_SSL_REDIRECT",
    "DJANGO_SECURE_HSTS_SECONDS",
    "CORS_ALLOWED_ORIGINS",
    "DATABASE_URL",
    "CLERK_ISSUER",
    "CLERK_ISSUER_LEGACY",
}

_PROD_ENV = {
    "DJANGO_SECRET_KEY": "abcdefghij" * 5,  # 50 chars, not "django-insecure-"
    "DJANGO_ALLOWED_HOSTS": "app.example.com",
    "DJANGO_CSRF_TRUSTED_ORIGINS": "https://app.example.com",
    "CORS_ALLOWED_ORIGINS": "https://web.example.com",
    "CLERK_ISSUER": "https://clerk.example.com",
}


def _clean_env(overrides):
    env = {k: v for k, v in os.environ.items() if k not in _SETTINGS_ENV_KEYS}
    env.update(overrides)
    return env


def _run(args, overrides):
    return subprocess.run(
        [sys.executable, str(MANAGE), *args],
        cwd=BACKEND_DIR,
        env=_clean_env(overrides),
        capture_output=True,
        text=True,
    )


def _setting(expr, overrides):
    """Return repr() of a settings expression evaluated in a fresh process."""
    result = _run(
        ["shell", "-c", f"from django.conf import settings; print(repr({expr}))"],
        overrides,
    )
    assert result.returncode == 0, result.stderr + result.stdout
    return result.stdout.strip().splitlines()[-1]


class DeployCheckTests(SimpleTestCase):
    def test_check_deploy_is_clean_with_production_env(self):
        result = _run(
            ["check", "--deploy", "--fail-level", "WARNING"], _PROD_ENV
        )
        self.assertEqual(
            result.returncode, 0, msg=result.stdout + result.stderr
        )
        self.assertIn(
            "System check identified no issues", result.stdout + result.stderr
        )

    def test_plain_check_passes_with_no_env(self):
        result = _run(["check"], {})
        self.assertEqual(
            result.returncode, 0, msg=result.stdout + result.stderr
        )


class LocalDevDefaultsTests(SimpleTestCase):
    def test_debug_is_true_with_no_env(self):
        self.assertEqual(_setting("settings.DEBUG", {}), "True")

    def test_database_defaults_to_sqlite_with_no_env(self):
        self.assertIn("sqlite3", _setting("settings.DATABASES['default']['ENGINE']", {}))

    def test_cors_is_wide_open_only_in_debug(self):
        self.assertEqual(_setting("settings.CORS_ALLOW_ALL_ORIGINS", {}), "True")
        self.assertEqual(
            _setting("settings.CORS_ALLOW_ALL_ORIGINS", _PROD_ENV), "False"
        )


class ProductionEnvTests(SimpleTestCase):
    def test_debug_is_false_when_prod_env_present(self):
        self.assertEqual(_setting("settings.DEBUG", _PROD_ENV), "False")

    def test_allowed_hosts_come_from_env(self):
        self.assertEqual(
            _setting("settings.ALLOWED_HOSTS", _PROD_ENV), "['app.example.com']"
        )

    def test_secret_key_comes_from_env(self):
        self.assertEqual(
            _setting("settings.SECRET_KEY", _PROD_ENV), repr("abcdefghij" * 5)
        )

    def test_security_hardening_active_when_not_debug(self):
        self.assertEqual(_setting("settings.SECURE_SSL_REDIRECT", _PROD_ENV), "True")
        self.assertEqual(_setting("settings.SESSION_COOKIE_SECURE", _PROD_ENV), "True")
        self.assertEqual(_setting("settings.CSRF_COOKIE_SECURE", _PROD_ENV), "True")
        self.assertEqual(
            _setting("settings.SECURE_PROXY_SSL_HEADER", _PROD_ENV),
            repr(("HTTP_X_FORWARDED_PROTO", "https")),
        )

    def test_missing_secret_key_without_debug_is_fatal(self):
        env = {k: v for k, v in _PROD_ENV.items() if k != "DJANGO_SECRET_KEY"}
        env["DJANGO_DEBUG"] = "false"
        result = _run(["check"], env)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("DJANGO_SECRET_KEY", result.stdout + result.stderr)

    def test_missing_clerk_issuer_without_debug_is_fatal(self):
        env = {k: v for k, v in _PROD_ENV.items() if k != "CLERK_ISSUER"}
        result = _run(["check"], env)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("CLERK_ISSUER", result.stdout + result.stderr)


class NoHardcodedProdValuesTests(SimpleTestCase):
    def test_settings_source_has_no_literal_secret_or_wildcard_hosts(self):
        source = (BACKEND_DIR / "config" / "settings.py").read_text()
        self.assertNotIn("django-insecure-@=3_", source)
        self.assertNotIn('ALLOWED_HOSTS = ["*"]', source)
        self.assertNotIn("CORS_ALLOW_ALL_ORIGINS = True", source)
