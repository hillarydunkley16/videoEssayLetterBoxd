"""Tests for GET /api/feed/ (logs by the people the viewer follows).

ClerkAuthentication is bypassed with DRF's force_authenticate.
"""
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIRequestFactory, force_authenticate

from movie_csv.models import Comment, Like, Log, VideoEssay
from movie_csv.views.api import FollowingFeed, FollowUser
from users.models import Follow

User = get_user_model()
TODAY = date(2026, 9, 20)


class FollowingFeedTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.viewer = User.objects.create(username="viewer")
        self.friend = User.objects.create(username="friend")
        self.stranger = User.objects.create(username="stranger")
        self.essay = VideoEssay.objects.create(title="An Essay", owner=self.stranger)
        Follow.objects.create(follower=self.viewer, followee=self.friend)

    def _log(self, owner, days_ago=0, text="review"):
        return Log.objects.create(
            owner=owner, essay=self.essay, date=TODAY - timedelta(days=days_ago),
            rating=4, review_text=text,
        )

    def _get(self, viewer="viewer", query=""):
        request = self.factory.get(f"/api/feed/{query}")
        user = self.viewer if viewer == "viewer" else viewer
        if user is not None:
            force_authenticate(request, user=user)
        return FollowingFeed.as_view()(request)

    def _ids(self, response):
        return [r["id"] for r in response.data["results"]]

    def test_unauthenticated_is_rejected(self):
        self.assertIn(self._get(viewer=None).status_code, (401, 403))

    def test_contains_followed_users_logs_only(self):
        mine = self._log(self.viewer)
        theirs = self._log(self.friend)
        strangers = self._log(self.stranger)

        ids = self._ids(self._get())

        self.assertEqual(ids, [theirs.id])
        self.assertNotIn(mine.id, ids)
        self.assertNotIn(strangers.id, ids)

    def test_own_logs_excluded_even_when_following_self_is_impossible(self):
        self._log(self.viewer)
        self.assertEqual(self._get().data["count"], 0)

    def test_ordered_newest_date_first_then_newest_id(self):
        old = self._log(self.friend, days_ago=5)
        first_today = self._log(self.friend, days_ago=0)
        second_today = self._log(self.friend, days_ago=0)

        self.assertEqual(self._ids(self._get()), [second_today.id, first_today.id, old.id])

    def test_serialized_with_the_log_serializer_shape(self):
        log = self._log(self.friend, text="great")

        row = self._get().data["results"][0]

        self.assertEqual(row["id"], log.id)
        self.assertEqual(row["owner"], "friend")
        self.assertEqual(row["owner_id"], self.friend.id)
        self.assertEqual(row["review_text"], "great")
        self.assertEqual(row["essay_details"]["title"], "An Essay")

    def test_pagination_second_page(self):
        for i in range(12):
            self._log(self.friend, days_ago=i)

        page1 = self._get()
        page2 = self._get(query="?page=2")

        self.assertEqual(page1.data["count"], 12)
        self.assertEqual(len(page1.data["results"]), 10)
        self.assertIsNotNone(page1.data["next"])
        self.assertEqual(len(page2.data["results"]), 2)
        self.assertIsNone(page2.data["next"])

    def test_following_nobody_is_an_empty_200(self):
        loner = User.objects.create(username="loner")
        self._log(self.friend)

        response = self._get(viewer=loner)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 0)
        self.assertEqual(response.data["results"], [])

    def test_unfollowing_removes_their_logs_and_following_again_restores_them(self):
        log = self._log(self.friend)
        self.assertEqual(self._ids(self._get()), [log.id])

        toggle = self.factory.post(f"/api/users/{self.friend.id}/follow/")
        force_authenticate(toggle, user=self.viewer)
        FollowUser.as_view()(toggle, user_id=self.friend.id)  # unfollow
        self.assertEqual(self._ids(self._get()), [])

        toggle = self.factory.post(f"/api/users/{self.friend.id}/follow/")
        force_authenticate(toggle, user=self.viewer)
        FollowUser.as_view()(toggle, user_id=self.friend.id)  # follow again
        self.assertEqual(self._ids(self._get()), [log.id])

    def test_query_count_is_constant_as_followees_and_logs_grow(self):
        def add_friend_with_activity(name):
            friend = User.objects.create(username=name)
            Follow.objects.create(follower=self.viewer, followee=friend)
            log = self._log(friend)
            Like.objects.create(user=self.stranger, post=log)
            Comment.objects.create(user=self.stranger, log=log, text="hi")

        add_friend_with_activity("f1")
        with CaptureQueriesContext(connection) as ctx:
            self._get()
        baseline = len(ctx)

        for i in range(2, 8):
            add_friend_with_activity(f"f{i}")
        with self.assertNumQueries(baseline):
            self._get()
