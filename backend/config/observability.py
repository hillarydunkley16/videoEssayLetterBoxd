"""Request IDs, structured (JSON) logs, and optional Sentry error reporting.

On-call questions this answers (see DEPLOY.md "Monitoring"):
  1. Is the API failing, and for which endpoints?  -> Sentry issues + `request` log lines
  2. Why did one user's request fail?               -> search logs/Sentry by request_id
  3. Is the API slow?                               -> `duration_ms` on `request` lines

Nothing here logs request bodies, query strings, headers, or tokens: only the
method, path, status, duration, and the numeric user id.
"""
import contextvars
import json
import logging
import os
import re
import time
import uuid

request_id_var = contextvars.ContextVar("request_id", default=None)

# Accept a caller-supplied id only if it is short and boring, so it can't be
# used to inject newlines or huge strings into the logs.
_SAFE_REQUEST_ID = re.compile(r"^[A-Za-z0-9._-]{8,64}$")

_STD_ATTRS = set(logging.LogRecord("", 0, "", 0, "", (), None).__dict__) | {"message", "asctime"}


class JsonFormatter(logging.Formatter):
    """One JSON object per line, with any `extra={...}` fields merged in."""

    def format(self, record):
        payload = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname.lower(),
            "logger": record.name,
            "event": record.getMessage(),
        }
        request_id = request_id_var.get()
        if request_id:
            payload["request_id"] = request_id
        for key, value in record.__dict__.items():
            if key not in _STD_ATTRS and not key.startswith("_"):
                payload[key] = value
        if record.exc_info:
            payload["exc"] = self.formatException(record.exc_info)
        return json.dumps(payload, default=str)


def build_logging_config(debug, level=None):
    level = (level or os.environ.get("LOG_LEVEL") or "INFO").upper()
    formatter = (
        {"format": "%(levelname)s %(name)s: %(message)s"}
        if debug
        else {"()": "config.observability.JsonFormatter"}
    )
    return {
        "version": 1,
        "disable_existing_loggers": False,
        "formatters": {"main": formatter},
        "handlers": {"console": {"class": "logging.StreamHandler", "formatter": "main"}},
        "root": {"handlers": ["console"], "level": level},
    }


class RequestLogMiddleware:
    """Attach a request id to every request/response and log one line per request."""

    logger = logging.getLogger("movie_csv.request")

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        supplied = request.headers.get("X-Request-ID", "")
        request_id = supplied if _SAFE_REQUEST_ID.match(supplied) else uuid.uuid4().hex
        token = request_id_var.set(request_id)
        started = time.monotonic()
        try:
            try:
                import sentry_sdk

                sentry_sdk.set_tag("request_id", request_id)
            except ImportError:  # pragma: no cover - sentry-sdk is a pinned dependency
                pass
            response = self.get_response(request)
            response["X-Request-ID"] = request_id
            self._log(request, response, started)
            return response
        finally:
            request_id_var.reset(token)

    def _log(self, request, response, started):
        # UptimeRobot pings /health/ every few minutes; only log it when it fails.
        if request.path == "/health/" and response.status_code < 500:
            return
        user = getattr(request, "user", None)
        level = (
            logging.ERROR
            if response.status_code >= 500
            else logging.WARNING
            if response.status_code >= 400
            else logging.INFO
        )
        self.logger.log(
            level,
            "request",
            extra={
                "method": request.method,
                "path": request.path,
                "status": response.status_code,
                "duration_ms": round((time.monotonic() - started) * 1000),
                "user_id": user.pk if getattr(user, "is_authenticated", False) else None,
            },
        )


def init_sentry(environ=None):
    """Start Sentry if SENTRY_DSN is set. Returns True when it was started."""
    env = os.environ if environ is None else environ
    dsn = (env.get("SENTRY_DSN") or "").strip()
    if not dsn:
        return False
    import sentry_sdk

    sentry_sdk.init(
        dsn=dsn,
        environment=env.get("SENTRY_ENVIRONMENT", "production"),
        release=env.get("RENDER_GIT_COMMIT") or None,
        send_default_pii=False,  # no IPs, cookies, or Authorization headers
        traces_sample_rate=float(env.get("SENTRY_TRACES_SAMPLE_RATE", "0")),
    )
    return True
