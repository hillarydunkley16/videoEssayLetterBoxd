"""Tests for movie_csv.views.api.PopularVideoEssays.

Ranks video essays by how many logs they got in the trailing 7 days, most
first. A log older than 7 days must not count, and an essay with no recent
logs must not appear at all.
"""
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIRequestFactory

from movie_csv.models import Log, VideoEssay
from movie_csv.views.api import PopularVideoEssays

User = get_user_model()

URL = "/api/VideoEssays/popular/"


class PopularVideoEssaysTests(TestCase):
    def setUp(self):
        self.user = User.objects.create(username="viewer")
        self.view = PopularVideoEssays.as_view()
        self.factory = APIRequestFactory()

    def _get(self):
        request = self.factory.get(URL)
        return self.view(request)

    def _log(self, essay, days_ago, owner=None):
        Log.objects.create(
            owner=owner or self.user,
            essay=essay,
            date=date.today() - timedelta(days=days_ago),
            rating=4,
            review_text="",
        )

    def test_ranks_by_log_count_within_the_last_week(self):
        popular = VideoEssay.objects.create(title="Popular", owner=self.user)
        quiet = VideoEssay.objects.create(title="Quiet", owner=self.user)
        for _ in range(3):
            self._log(popular, days_ago=1)
        self._log(quiet, days_ago=1)

        response = self._get()

        self.assertEqual(response.status_code, 200)
        results = response.data["results"]
        titles = [row["title"] for row in results]
        self.assertEqual(titles[0], "Popular")
        self.assertIn("Quiet", titles)
        by_title = {row["title"]: row["log_count"] for row in results}
        self.assertEqual(by_title["Popular"], 3)
        self.assertEqual(by_title["Quiet"], 1)

    def test_logs_on_different_days_still_aggregate_into_one_row(self):
        # Regression: ordering by a related field (log__date) used to pull
        # it into the GROUP BY and split one essay's count across rows.
        popular = VideoEssay.objects.create(title="Popular", owner=self.user)
        quiet = VideoEssay.objects.create(title="Quiet", owner=self.user)
        self._log(popular, days_ago=1)
        self._log(popular, days_ago=2)
        self._log(popular, days_ago=3)
        self._log(quiet, days_ago=1)

        response = self._get()

        results = response.data["results"]
        self.assertEqual(len(results), 2)
        by_title = {row["title"]: row["log_count"] for row in results}
        self.assertEqual(by_title["Popular"], 3)
        self.assertEqual(by_title["Quiet"], 1)

    def test_excludes_essays_with_no_logs_in_the_last_week(self):
        stale = VideoEssay.objects.create(title="Stale", owner=self.user)
        self._log(stale, days_ago=10)

        response = self._get()

        titles = [row["title"] for row in response.data["results"]]
        self.assertNotIn("Stale", titles)

    def test_essay_with_no_logs_at_all_is_absent(self):
        VideoEssay.objects.create(title="Untouched", owner=self.user)

        response = self._get()

        self.assertEqual(response.data["results"], [])

    def test_is_publicly_readable(self):
        response = self._get()
        self.assertEqual(response.status_code, 200)
