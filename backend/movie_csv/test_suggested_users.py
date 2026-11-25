"""Tests for GET /api/users/suggestions/. ClerkAuthentication is bypassed with force_authenticate."""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from movie_csv.views.api import SuggestedUsers
from users.models import Follow

User = get_user_model()


def _make_user(username, display_username=True, **kwargs):
    """Create a user whose Profile carries a Clerk username (as ClerkAuthentication stores it)."""
    user = User.objects.create(username=username, **kwargs)
    if display_username:
        user.profile.display_username = username
        user.profile.save()
    return user


class SuggestedUsersTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.me = _make_user(username="me")

    def _get(self, viewer=None):
        request = self.factory.get("/api/users/suggestions/")
        if viewer is not None:
            force_authenticate(request, user=viewer)
        return SuggestedUsers.as_view()(request)

    def test_unauthenticated_is_rejected(self):
        self.assertIn(self._get().status_code, (401, 403))

    def test_excludes_self_and_already_followed(self):
        followed = _make_user(username="followed")
        other = _make_user(username="other")
        Follow.objects.create(follower=self.me, followee=followed)
        response = self._get(self.me)
        self.assertEqual([u["username"] for u in response.data], ["other"])
        self.assertFalse(response.data[0]["is_following"])
        self.assertEqual(response.data[0]["id"], other.id)

    def test_most_followed_first_and_capped_at_five(self):
        popular = _make_user(username="popular")
        fan = _make_user(username="fan")
        Follow.objects.create(follower=fan, followee=popular)
        for i in range(6):
            _make_user(username=f"u{i}")
        response = self._get(self.me)
        self.assertEqual(len(response.data), 5)
        self.assertEqual(response.data[0]["username"], "popular")

    def test_shows_display_username_and_anonymous_fallback(self):
        named = User.objects.create(username="user_2abcClerkId")
        named.profile.display_username = "hillary"
        named.profile.save()
        anon = _make_user("user_2xyzClerkId", display_username=False)
        response = self._get(self.me)
        self.assertEqual(
            {u["id"]: u["username"] for u in response.data},
            {named.id: "hillary", anon.id: "Anonymous"},
        )
