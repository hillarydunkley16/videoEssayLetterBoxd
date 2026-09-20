"""Tests for the follow fields on the profile endpoints.

Profiles used to embed every follower and following user in full. They now carry
followers_count, following_count and a viewer-relative is_following, all derived
from users.Follow rows.

ClerkAuthentication is bypassed with DRF's force_authenticate.
"""
from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIRequestFactory, force_authenticate

from movie_csv.views.api import ProfileDetail, ProfileDetailById
from users.models import Follow, Profile

User = get_user_model()


class ProfileFollowFieldsTests(TestCase):
    def setUp(self):
        self.alice = User.objects.create(username="alice")
        self.bob = User.objects.create(username="bob")
        self.carol = User.objects.create(username="carol")
        for user in (self.alice, self.bob, self.carol):
            Profile.objects.get_or_create(user=user)
        self.factory = APIRequestFactory()

    def _profile_of(self, viewer, target):
        request = self.factory.get(f"/api/users/profile/{target.id}/")
        force_authenticate(request, user=viewer)
        return ProfileDetailById.as_view()(request, user_id=target.id)

    def _own_profile(self, viewer):
        request = self.factory.get("/api/users/profile")
        force_authenticate(request, user=viewer)
        return ProfileDetail.as_view()(request)

    def test_response_has_counts_and_no_embedded_user_lists(self):
        response = self._profile_of(self.alice, self.bob)

        self.assertEqual(response.status_code, 200)
        self.assertIn("followers_count", response.data)
        self.assertIn("following_count", response.data)
        self.assertIn("is_following", response.data)
        self.assertNotIn("followers", response.data)
        self.assertNotIn("following", response.data)

    def test_counts_reflect_follow_rows(self):
        Follow.objects.create(follower=self.alice, followee=self.bob)
        Follow.objects.create(follower=self.carol, followee=self.bob)
        Follow.objects.create(follower=self.bob, followee=self.alice)

        response = self._profile_of(self.alice, self.bob)

        self.assertEqual(response.data["followers_count"], 2)
        self.assertEqual(response.data["following_count"], 1)

    def test_counts_ignore_the_legacy_m2m(self):
        Profile.objects.get(user=self.bob).followers.add(self.alice)

        response = self._profile_of(self.alice, self.bob)

        self.assertEqual(response.data["followers_count"], 0)

    def test_is_following_true_when_viewer_follows_the_profile(self):
        Follow.objects.create(follower=self.alice, followee=self.bob)

        self.assertTrue(self._profile_of(self.alice, self.bob).data["is_following"])

    def test_is_following_false_when_viewer_does_not_follow(self):
        Follow.objects.create(follower=self.bob, followee=self.alice)  # wrong direction

        self.assertFalse(self._profile_of(self.alice, self.bob).data["is_following"])

    def test_is_following_is_false_on_your_own_profile(self):
        self.assertFalse(self._profile_of(self.alice, self.alice).data["is_following"])

    def test_own_profile_endpoint_carries_the_same_fields(self):
        Follow.objects.create(follower=self.bob, followee=self.alice)
        Follow.objects.create(follower=self.alice, followee=self.carol)

        response = self._own_profile(self.alice)

        self.assertEqual(response.data["followers_count"], 1)
        self.assertEqual(response.data["following_count"], 1)
        self.assertFalse(response.data["is_following"])
        self.assertNotIn("followers", response.data)

    def test_query_count_does_not_grow_with_followers(self):
        def queries_for_profile():
            with CaptureQueriesContext(connection) as ctx:
                self._profile_of(self.alice, self.bob)
            return len(ctx)

        # The first fetch also creates the profile's auto-provisioned watchlist, which is
        # unrelated to follows, so warm it up before measuring.
        self._profile_of(self.alice, self.bob)
        Follow.objects.create(follower=self.alice, followee=self.bob)
        few = queries_for_profile()

        for i in range(20):
            Follow.objects.create(follower=User.objects.create(username=f"fan{i}"), followee=self.bob)
        many = queries_for_profile()

        self.assertEqual(few, many)
