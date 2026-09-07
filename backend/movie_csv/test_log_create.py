"""Tests for movie_csv.views.api.logList.create idempotency.

A double-tapped "Save Log" in the frontend sends the same payload twice.
The create view must insert exactly one row for an identical repeat, so a
duplicate submission can't produce two logs.

ClerkAuthentication is bypassed with DRF's force_authenticate — these cover
the view's own dedupe logic, not auth.
"""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from movie_csv.models import Log, VideoEssay
from movie_csv.views.api import logList

User = get_user_model()

URL = "/api/logList/"


class LogCreateIdempotencyTests(TestCase):
    def setUp(self):
        self.user = User.objects.create(username="clerk_user")
        self.essay = VideoEssay.objects.create(title="An Essay", owner=self.user)
        self.view = logList.as_view()
        self.factory = APIRequestFactory()
        self.payload = {
            "essay": str(self.essay.public_id),
            "date": "2026-09-07",
            "rating": 4,
            "review_text": "Sharp and well argued.",
            "rewatch": False,
        }

    def _post(self, payload=None):
        request = self.factory.post(URL, payload or self.payload, format="json")
        force_authenticate(request, user=self.user)
        return self.view(request)

    def test_first_post_creates_a_log(self):
        response = self._post()
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Log.objects.count(), 1)

    def test_identical_repeat_post_does_not_create_a_second_log(self):
        first = self._post()
        second = self._post()

        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(Log.objects.count(), 1)
        # the repeat returns the already-saved log, not a new one
        self.assertEqual(
            second.data["public_id"], first.data["public_id"]
        )

    def test_different_rating_still_creates_a_distinct_log(self):
        self._post()
        rewatch = {**self.payload, "rating": 5, "review_text": "Even better second time."}
        response = self._post(rewatch)

        self.assertEqual(response.status_code, 201)
        self.assertEqual(Log.objects.count(), 2)
