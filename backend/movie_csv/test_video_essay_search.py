"""Tests for movie_csv.views.api.VideoEssays' search support.

Regression: the /search-bar/ ?search=<query> query used to be ignored — the
frontend fetched the (paginated, PAGE_SIZE=10) unfiltered listing and did the
keyword match client-side on whatever page 1 happened to contain. An
already-logged essay that wasn't in the first 10 rows was unsearchable no
matter what you typed. This asserts the endpoint actually filters server-side
across the whole table.
"""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIRequestFactory

from movie_csv.models import VideoEssay
from movie_csv.views.api import VideoEssays

User = get_user_model()

URL = "/api/VideoEssays/"


class VideoEssaySearchTests(TestCase):
    def setUp(self):
        self.user = User.objects.create(username="owner")
        self.view = VideoEssays.as_view()
        self.factory = APIRequestFactory()

    def _get(self, **params):
        request = self.factory.get(URL, params)
        return self.view(request)

    def test_search_matches_a_title_past_the_first_page(self):
        # PAGE_SIZE is 10 — create enough unrelated essays that the target
        # would have fallen off page 1 of the unfiltered listing.
        for i in range(12):
            VideoEssay.objects.create(title=f"Unrelated Essay {i}", owner=self.user)
        target = VideoEssay.objects.create(title="The Rule of Threes", owner=self.user)

        response = self._get(search="rule of threes")

        self.assertEqual(response.status_code, 200)
        titles = [row["title"] for row in response.data["results"]]
        self.assertEqual(titles, [target.title])

    def test_search_matches_channel_name(self):
        VideoEssay.objects.create(title="Unrelated", channel_name="Some Channel", owner=self.user)
        target = VideoEssay.objects.create(
            title="Another Essay", channel_name="Every Frame a Painting", owner=self.user
        )

        response = self._get(search="every frame")

        titles = [row["title"] for row in response.data["results"]]
        self.assertEqual(titles, [target.title])

    def test_no_query_returns_everything(self):
        VideoEssay.objects.create(title="One", owner=self.user)
        VideoEssay.objects.create(title="Two", owner=self.user)

        response = self._get()

        self.assertEqual(response.data["count"], 2)

    def test_no_match_returns_empty(self):
        VideoEssay.objects.create(title="One", owner=self.user)

        response = self._get(search="nothing like that exists")

        self.assertEqual(response.data["results"], [])
