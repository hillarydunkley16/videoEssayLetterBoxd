"""GET /api/users/ must show display usernames, never the Clerk id Django stores as `username`.

ClerkAuthentication is bypassed with DRF's force_authenticate.
"""
from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIRequestFactory, force_authenticate

from movie_csv.views.api import UserList

User = get_user_model()


def _make_user(clerk_id, display_username=None):
    user = User.objects.create(username=clerk_id)
    if display_username:
        user.profile.display_username = display_username
        user.profile.save()
    return user


class UserListTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.me = _make_user("user_2meClerkId", "me_handle")

    def _get(self, viewer="me"):
        request = self.factory.get("/api/users/")
        user = self.me if viewer == "me" else viewer
        if user is not None:
            force_authenticate(request, user=user)
        return UserList.as_view()(request)

    def test_unauthenticated_is_rejected(self):
        self.assertIn(self._get(viewer=None).status_code, (401, 403))

    def test_usernames_are_display_usernames(self):
        _make_user("user_2friendClerkId", "friend_handle")
        response = self._get()
        self.assertEqual(
            sorted(r["username"] for r in response.data["results"]), ["friend_handle", "me_handle"]
        )

    def test_user_without_a_display_username_is_anonymous(self):
        _make_user("user_2anonClerkId")
        names = [r["username"] for r in self._get().data["results"]]
        self.assertIn("Anonymous", names)

    def test_no_clerk_id_appears_anywhere_in_the_response(self):
        _make_user("user_2friendClerkId", "friend_handle")
        _make_user("user_2anonClerkId")
        self.assertNotIn("user_2", str(self._get().data))

    def test_ids_and_logs_shape_are_unchanged(self):
        row = self._get().data["results"][0]
        self.assertEqual(set(row), {"id", "username", "logs"})
        self.assertEqual(row["id"], self.me.id)

    def test_query_count_does_not_grow_with_rows(self):
        for i in range(2):
            _make_user(f"user_a{i}", f"a{i}")
        with CaptureQueriesContext(connection) as small:
            self._get()
        for i in range(6):
            _make_user(f"user_b{i}", f"b{i}")
        with CaptureQueriesContext(connection) as large:
            self._get()
        self.assertEqual(len(small), len(large))
