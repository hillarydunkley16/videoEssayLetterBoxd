"""/health/ is the uptime-monitor target: public, cheap, and it touches the
database so a ping also keeps a free-tier Supabase project from pausing."""
from unittest import mock

from django.db import OperationalError
from django.test import TestCase


class HealthEndpointTests(TestCase):
    def test_returns_200_without_auth(self):
        response = self.client.get("/health/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_returns_503_when_database_is_unreachable(self):
        with mock.patch(
            "movie_csv.health.connection.cursor", side_effect=OperationalError("down")
        ):
            response = self.client.get("/health/")
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"status": "unavailable"})

    def test_response_is_not_cacheable(self):
        response = self.client.get("/health/")
        self.assertIn("no-store", response["Cache-Control"])

    def test_head_request_is_allowed(self):
        # Some uptime monitors default to HEAD.
        self.assertEqual(self.client.head("/health/").status_code, 200)

    def test_post_is_rejected(self):
        self.assertEqual(self.client.post("/health/").status_code, 405)
