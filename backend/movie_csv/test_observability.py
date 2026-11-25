import json
import logging
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase

from config import observability
from config.observability import JsonFormatter, init_sentry, request_id_var


class RequestIdTests(TestCase):
    def test_response_carries_a_generated_request_id(self):
        response = self.client.get("/health/")
        self.assertRegex(response["X-Request-ID"], r"^[0-9a-f]{32}$")

    def test_safe_caller_supplied_id_is_echoed(self):
        response = self.client.get("/health/", HTTP_X_REQUEST_ID="abc-12345-xyz")
        self.assertEqual(response["X-Request-ID"], "abc-12345-xyz")

    def test_unsafe_caller_supplied_id_is_replaced(self):
        response = self.client.get("/health/", HTTP_X_REQUEST_ID="bad id\nwith newline")
        self.assertRegex(response["X-Request-ID"], r"^[0-9a-f]{32}$")

    def test_request_id_is_cleared_after_the_request(self):
        self.client.get("/health/")
        self.assertIsNone(request_id_var.get())


class RequestLogTests(TestCase):
    def test_logs_one_structured_line_without_query_string(self):
        with self.assertLogs("movie_csv.request", level="INFO") as logs:
            self.client.get("/api/nope/?token=secret")
        record = logs.records[0]
        self.assertEqual(record.method, "GET")
        self.assertEqual(record.path, "/api/nope/")
        self.assertEqual(record.status, 404)
        self.assertIsInstance(record.duration_ms, int)
        self.assertNotIn("secret", json.dumps(record.__dict__, default=str))
        self.assertEqual(record.levelno, logging.WARNING)

    def test_healthy_health_checks_are_not_logged(self):
        with self.assertNoLogs("movie_csv.request", level="INFO"):
            self.client.get("/health/")

    def test_failing_health_checks_are_logged_as_errors(self):
        from django.db import DatabaseError

        with mock.patch("movie_csv.health.connection.cursor", side_effect=DatabaseError):
            with self.assertLogs("movie_csv.request", level="ERROR") as logs:
                self.client.get("/health/")
        self.assertEqual(logs.records[0].status, 503)

    def test_authenticated_requests_record_the_user_id(self):
        user = get_user_model().objects.create_user("u1", password="x")
        self.client.force_login(user)
        with self.assertLogs("movie_csv.request", level="INFO") as logs:
            self.client.get("/api/nope/")
        self.assertEqual(logs.records[0].user_id, user.pk)


class JsonFormatterTests(SimpleTestCase):
    def _format(self, **extra):
        record = logging.LogRecord("t", logging.INFO, __file__, 1, "something happened", (), None)
        for key, value in extra.items():
            setattr(record, key, value)
        return json.loads(JsonFormatter().format(record))

    def test_emits_event_level_and_extra_fields(self):
        out = self._format(status=200)
        self.assertEqual(out["event"], "something happened")
        self.assertEqual(out["level"], "info")
        self.assertEqual(out["status"], 200)

    def test_includes_the_current_request_id(self):
        token = request_id_var.set("req-123456")
        try:
            self.assertEqual(self._format()["request_id"], "req-123456")
        finally:
            request_id_var.reset(token)

    def test_includes_exception_text(self):
        try:
            raise ValueError("boom")
        except ValueError:
            import sys

            record = logging.LogRecord("t", logging.ERROR, __file__, 1, "failed", (), sys.exc_info())
        self.assertIn("ValueError: boom", json.loads(JsonFormatter().format(record))["exc"])


class SentryInitTests(SimpleTestCase):
    def test_does_nothing_without_a_dsn(self):
        with mock.patch("sentry_sdk.init") as init:
            self.assertFalse(init_sentry({}))
        init.assert_not_called()

    def test_starts_sentry_without_pii_when_dsn_is_set(self):
        env = {"SENTRY_DSN": "https://key@o0.ingest.sentry.io/1", "RENDER_GIT_COMMIT": "abc123"}
        with mock.patch("sentry_sdk.init") as init:
            self.assertTrue(init_sentry(env))
        kwargs = init.call_args.kwargs
        self.assertFalse(kwargs["send_default_pii"])
        self.assertEqual(kwargs["release"], "abc123")
        self.assertEqual(kwargs["traces_sample_rate"], 0.0)

    def test_logging_config_is_json_in_production_and_plain_in_debug(self):
        self.assertIn("()", observability.build_logging_config(debug=False)["formatters"]["main"])
        self.assertNotIn("()", observability.build_logging_config(debug=True)["formatters"]["main"])
