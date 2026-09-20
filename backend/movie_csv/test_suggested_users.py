"""Tests for GET /api/users/suggestions/. ClerkAuthentication is bypassed with force_authenticate."""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from movie_csv.views.api import SuggestedUsers
from users.models import Follow

User = get_user_model()


class SuggestedUsersTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.me = User.objects.create(username="me")

    def _get(self, viewer=None):
        request = self.factory.get("/api/users/suggestions/")
        if viewer is not None:
            force_authenticate(request, user=viewer)
        return SuggestedUsers.as_view()(request)

    def test_unauthenticated_is_rejected(self):
        self.assertIn(self._get().status_code, (401, 403))

    def test_excludes_self_and_already_followed(self):
        followed = User.objects.create(username="followed")
        other = User.objects.create(username="other")
        Follow.objects.create(follower=self.me, followee=followed)
        response = self._get(self.me)
        self.assertEqual([u["username"] for u in response.data], ["other"])
        self.assertFalse(response.data[0]["is_following"])
        self.assertEqual(response.data[0]["id"], other.id)

    def test_most_followed_first_and_capped_at_five(self):
        popular = User.objects.create(username="popular")
        fan = User.objects.create(username="fan")
        Follow.objects.create(follower=fan, followee=popular)
        for i in range(6):
            User.objects.create(username=f"u{i}")
        response = self._get(self.me)
        self.assertEqual(len(response.data), 5)
        self.assertEqual(response.data[0]["username"], "popular")
