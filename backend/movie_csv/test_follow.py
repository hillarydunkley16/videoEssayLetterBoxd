"""Tests for movie_csv.views.api.FollowUser.

A single POST toggles the follow relationship and must keep both sides of it
consistent: the caller's Profile.following and the target's Profile.followers
are two independent M2M tables, and a bug here is exactly the kind that lets
them drift apart.

ClerkAuthentication is bypassed with DRF's force_authenticate.
"""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from movie_csv.views.api import FollowUser
from users.models import Profile

User = get_user_model()


def url(user_id):
    return f"/api/users/{user_id}/follow/"


class FollowUserTests(TestCase):
    def setUp(self):
        self.alice = User.objects.create(username="alice")
        self.bob = User.objects.create(username="bob")
        self.view = FollowUser.as_view()
        self.factory = APIRequestFactory()

    def _post(self, actor, target_id):
        request = self.factory.post(url(target_id))
        force_authenticate(request, user=actor)
        return self.view(request, user_id=target_id)

    def test_follow_adds_both_sides_of_the_relationship(self):
        response = self._post(self.alice, self.bob.id)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["following"])
        alice_profile = Profile.objects.get(user=self.alice)
        bob_profile = Profile.objects.get(user=self.bob)
        self.assertIn(self.bob, alice_profile.following.all())
        self.assertIn(self.alice, bob_profile.followers.all())

    def test_second_post_unfollows_and_removes_both_sides(self):
        self._post(self.alice, self.bob.id)
        response = self._post(self.alice, self.bob.id)

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["following"])
        alice_profile = Profile.objects.get(user=self.alice)
        bob_profile = Profile.objects.get(user=self.bob)
        self.assertNotIn(self.bob, alice_profile.following.all())
        self.assertNotIn(self.alice, bob_profile.followers.all())

    def test_followers_count_reflects_the_target(self):
        self._post(self.alice, self.bob.id)
        response = self._post(User.objects.create(username="carol"), self.bob.id)

        self.assertEqual(response.data["followers_count"], 2)

    def test_cannot_follow_self(self):
        response = self._post(self.alice, self.alice.id)
        self.assertEqual(response.status_code, 400)

    def test_target_user_not_found(self):
        response = self._post(self.alice, 99999)
        self.assertEqual(response.status_code, 404)
