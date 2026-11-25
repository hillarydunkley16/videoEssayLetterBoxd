"""`is_liked` tells the frontend whether the signed-in viewer has liked a log.

The frontend used to work this out from the `likes` array, but each like is just
{user: <pk>, post: <pk>} and the viewer only knows their Clerk id, so it was always false.
ClerkAuthentication is bypassed with DRF's force_authenticate.
"""
from datetime import date

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIRequestFactory, force_authenticate

from movie_csv.models import Like, Log, VideoEssay
from movie_csv.serializers import LogSerializer
from movie_csv.views.api import VideoInfo, logDetail, logList

User = get_user_model()


class LogIsLikedTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.me = User.objects.create(username="me")
        self.friend = User.objects.create(username="friend")
        self.essay = VideoEssay.objects.create(title="An Essay", owner=self.friend)

    def _log(self, owner=None):
        return Log.objects.create(
            owner=owner or self.friend, essay=self.essay, date=date(2026, 9, 20), rating=4, review_text="r"
        )

    def _call(self, view, viewer=None, **kwargs):
        request = self.factory.get("/api/anything/")
        if viewer is not None:
            force_authenticate(request, user=viewer)
        return view(request, **kwargs)

    def _rows(self, response):
        data = response.data
        return data["results"] if isinstance(data, dict) and "results" in data else data

    def test_true_when_the_viewer_liked_the_log(self):
        log = self._log()
        Like.objects.create(user=self.me, post=log)
        row = self._rows(self._call(logList.as_view(), self.me))[0]
        self.assertTrue(row["is_liked"])

    def test_false_when_only_someone_else_liked_it(self):
        log = self._log()
        Like.objects.create(user=self.friend, post=log)
        row = self._rows(self._call(logList.as_view(), self.me))[0]
        self.assertFalse(row["is_liked"])
        self.assertEqual(len(row["likes"]), 1)

    def test_false_when_nobody_liked_it(self):
        self._log()
        row = self._rows(self._call(logList.as_view(), self.me))[0]
        self.assertFalse(row["is_liked"])

    def test_is_relative_to_each_viewer(self):
        log = self._log()
        Like.objects.create(user=self.me, post=log)
        as_me = self._rows(self._call(logList.as_view(), self.me))[0]["is_liked"]
        as_friend = self._rows(self._call(logList.as_view(), self.friend))[0]["is_liked"]
        self.assertEqual((as_me, as_friend), (True, False))

    def test_false_without_a_request_in_the_context(self):
        log = self._log()
        Like.objects.create(user=self.me, post=log)
        self.assertFalse(LogSerializer(log).data["is_liked"])

    def test_log_detail_reports_is_liked(self):
        log = self._log()
        Like.objects.create(user=self.me, post=log)
        response = self._call(logDetail.as_view(), self.me, public_id=log.public_id)
        self.assertTrue(response.data["log"]["is_liked"])

    def test_video_info_is_public_and_is_liked_is_false_for_anonymous_viewers(self):
        log = self._log()
        Like.objects.create(user=self.me, post=log)
        response = self._call(VideoInfo.as_view(), None, public_id=self.essay.public_id)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["logs"][0]["is_liked"])

    def test_video_info_is_liked_is_true_for_the_signed_in_liker(self):
        log = self._log()
        Like.objects.create(user=self.me, post=log)
        response = self._call(VideoInfo.as_view(), self.me, public_id=self.essay.public_id)
        self.assertTrue(response.data["logs"][0]["is_liked"])

    def test_query_count_does_not_grow_with_rows(self):
        def add(n, start):
            for i in range(start, start + n):
                log = self._log(User.objects.create(username=f"author{i}"))
                Like.objects.create(user=self.me, post=log)

        add(2, 0)
        with CaptureQueriesContext(connection) as small:
            self._call(logList.as_view(), self.me)
        add(6, 2)
        with CaptureQueriesContext(connection) as large:
            self._call(logList.as_view(), self.me)
        self.assertEqual(len(small), len(large))
