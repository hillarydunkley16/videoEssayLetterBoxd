"""Log/comment owners show Clerk usernames, and logs know whether the viewer owns them.

ClerkAuthentication is bypassed with DRF's force_authenticate.
"""
from datetime import date

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIRequestFactory, force_authenticate

from movie_csv.models import Comment, Like, Log, VideoEssay
from movie_csv.views.api import CommentOnPost, VideoInfo, logDetail, logList, userLogs

User = get_user_model()
TODAY = date(2026, 9, 20)


def _make_user(clerk_id, display_username="unset"):
    """A user as ClerkAuthentication provisions it: Django username = Clerk sub."""
    user = User.objects.create(username=clerk_id)
    if display_username != "unset":
        user.profile.display_username = display_username
        user.profile.save()
    return user


class LogOwnerUsernameTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.me = _make_user("user_2meClerkId", "me_handle")
        self.friend = _make_user("user_2friendClerkId", "friend_handle")
        self.anon = _make_user("user_2anonClerkId")  # no display username yet
        self.essay = VideoEssay.objects.create(title="An Essay", owner=self.friend)

    def _log(self, owner):
        return Log.objects.create(owner=owner, essay=self.essay, date=TODAY, rating=4, review_text="r")

    def _call(self, view, viewer=None, **kwargs):
        request = self.factory.get("/api/anything/")
        if viewer is not None:
            force_authenticate(request, user=viewer)
        return view(request, **kwargs)

    def _rows(self, response):
        data = response.data
        return data["results"] if isinstance(data, dict) and "results" in data else data

    # --- owner name -------------------------------------------------------

    def test_log_owner_is_the_display_username_not_the_clerk_id(self):
        self._log(self.friend)
        row = self._rows(self._call(logList.as_view(), self.me))[0]
        self.assertEqual(row["owner"], "friend_handle")

    def test_log_owner_without_display_username_is_anonymous(self):
        self._log(self.anon)
        row = self._rows(self._call(logList.as_view(), self.me))[0]
        self.assertEqual(row["owner"], "Anonymous")

    def test_owner_id_is_unchanged(self):
        self._log(self.friend)
        row = self._rows(self._call(logList.as_view(), self.me))[0]
        self.assertEqual(row["owner_id"], self.friend.id)

    def test_comment_user_is_the_display_username(self):
        log = self._log(self.friend)
        Comment.objects.create(user=self.me, log=log, text="nice")
        Comment.objects.create(user=self.anon, log=log, text="hm")
        row = self._rows(self._call(logList.as_view(), self.me))[0]
        self.assertEqual(sorted(c["user"] for c in row["comments"]), ["Anonymous", "me_handle"])

    def test_new_comment_response_uses_the_display_username(self):
        log = self._log(self.friend)
        request = self.factory.post(f"/api/logs/{log.public_id}/comments/", {"text": "hi"}, format="json")
        force_authenticate(request, user=self.me)
        response = CommentOnPost.as_view()(request, public_id=log.public_id)
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["user"], "me_handle")

    # --- is_mine ----------------------------------------------------------

    def test_is_mine_is_true_only_for_the_viewers_own_logs(self):
        mine, theirs = self._log(self.me), self._log(self.friend)
        rows = {r["id"]: r["is_mine"] for r in self._rows(self._call(logList.as_view(), self.me))}
        self.assertEqual(rows, {mine.id: True, theirs.id: False})

    def test_log_detail_passes_the_request_so_is_mine_is_set(self):
        log = self._log(self.me)
        response = self._call(logDetail.as_view(), self.me, public_id=log.public_id)
        self.assertTrue(response.data["log"]["is_mine"])
        self.assertEqual(response.data["log"]["owner"], "me_handle")

    def test_video_info_is_public_and_is_mine_is_false_for_anonymous_viewers(self):
        self._log(self.friend)
        response = self._call(VideoInfo.as_view(), None, public_id=self.essay.public_id)
        self.assertEqual(response.status_code, 200)
        row = response.data["logs"][0]
        self.assertEqual(row["owner"], "friend_handle")
        self.assertFalse(row["is_mine"])

    def test_video_info_is_mine_is_true_for_the_signed_in_owner(self):
        self._log(self.me)
        response = self._call(VideoInfo.as_view(), self.me, public_id=self.essay.public_id)
        self.assertTrue(response.data["logs"][0]["is_mine"])

    def test_user_logs_are_all_mine(self):
        self._log(self.me)
        rows = self._rows(self._call(userLogs.as_view(), self.me))
        self.assertTrue(all(r["is_mine"] for r in rows))
        self.assertEqual(rows[0]["owner"], "me_handle")

    # --- query counts -----------------------------------------------------

    def _add_logs(self, n, start=0):
        for i in range(start, start + n):
            author = _make_user(f"user_author{i}", f"author{i}")
            log = self._log(author)
            Comment.objects.create(user=_make_user(f"user_commenter{i}", f"c{i}"), log=log, text="x")
            Like.objects.create(user=self.me, post=log)

    def _query_count(self, view, viewer, **kwargs):
        with CaptureQueriesContext(connection) as ctx:
            response = self._call(view, viewer, **kwargs)
            response.render() if hasattr(response, "render") else None
        return len(ctx)

    def test_log_list_query_count_does_not_grow_with_rows(self):
        self._add_logs(2)
        small = self._query_count(logList.as_view(), self.me)
        self._add_logs(6, start=2)
        large = self._query_count(logList.as_view(), self.me)
        self.assertEqual(small, large)

    def test_video_info_query_count_does_not_grow_with_rows(self):
        self._add_logs(2)
        small = self._query_count(VideoInfo.as_view(), self.me, public_id=self.essay.public_id)
        self._add_logs(6, start=2)
        large = self._query_count(VideoInfo.as_view(), self.me, public_id=self.essay.public_id)
        self.assertEqual(small, large)
