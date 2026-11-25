"""Tests for movie_csv.views.api.FollowUser.

A single POST toggles a users.Follow row, which is the only record of a follow.

ClerkAuthentication is bypassed with DRF's force_authenticate.
"""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from movie_csv.views.api import FollowUser
from users.models import Follow, Profile

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

    def test_follow_creates_one_follow_row(self):
        response = self._post(self.alice, self.bob.id)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["following"])
        self.assertEqual(Follow.objects.filter(follower=self.alice, followee=self.bob).count(), 1)

    def test_second_post_unfollows_and_deletes_the_row(self):
        self._post(self.alice, self.bob.id)
        response = self._post(self.alice, self.bob.id)

        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["following"])
        self.assertFalse(Follow.objects.filter(follower=self.alice, followee=self.bob).exists())

    def test_repeated_toggles_alternate_and_leave_one_or_zero_rows(self):
        results = [self._post(self.alice, self.bob.id).data["following"] for _ in range(4)]

        self.assertEqual(results, [True, False, True, False])
        self.assertEqual(Follow.objects.count(), 0)

    def test_follow_is_directional(self):
        self._post(self.alice, self.bob.id)

        self.assertFalse(Follow.objects.filter(follower=self.bob, followee=self.alice).exists())

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

    def test_unauthenticated_request_is_rejected(self):
        request = self.factory.post(url(self.bob.id))

        response = self.view(request, user_id=self.bob.id)

        self.assertIn(response.status_code, (401, 403))
        self.assertEqual(Follow.objects.count(), 0)

    def test_self_follow_creates_no_row(self):
        self._post(self.alice, self.alice.id)

        self.assertEqual(Follow.objects.count(), 0)
