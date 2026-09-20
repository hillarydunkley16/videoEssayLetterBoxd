"""Tests for the followers list endpoint (GET /api/users/<id>/followers/).

ClerkAuthentication is bypassed with DRF's force_authenticate.
"""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from movie_csv.views.api import FollowersList, FollowingList
from users.models import Follow

User = get_user_model()


class FollowersListTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.view = FollowersList.as_view()
        self.target = User.objects.create(username="target")
        self.viewer = User.objects.create(username="viewer")

    def _get(self, user_id, viewer=None, query=""):
        request = self.factory.get(f"/api/users/{user_id}/followers/{query}")
        if viewer is not None:
            force_authenticate(request, user=viewer)
        return self.view(request, user_id=user_id)

    def _follow(self, follower, followee, age_minutes=0):
        follow = Follow.objects.create(follower=follower, followee=followee)
        Follow.objects.filter(pk=follow.pk).update(
            created_at=timezone.now() - timedelta(minutes=age_minutes)
        )
        return follow

    def _make_followers(self, n):
        users = [User.objects.create(username=f"f{i}") for i in range(n)]
        for i, user in enumerate(users):
            self._follow(user, self.target, age_minutes=i)
        return users

    def test_unauthenticated_is_rejected(self):
        response = self._get(self.target.id)
        self.assertIn(response.status_code, (401, 403))

    def test_unknown_user_is_404(self):
        response = self._get(999999, self.viewer)
        self.assertEqual(response.status_code, 404)

    def test_rows_have_expected_fields_and_no_private_data(self):
        a = User.objects.create(username="a", email="a@example.com")
        a.profile.imageUrl = "https://img.example.com/a.png"
        a.profile.save()
        self._follow(a, self.target)

        response = self._get(self.target.id, self.viewer)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(
            response.data["results"][0],
            {
                "id": a.id,
                "username": "a",
                "imageUrl": "https://img.example.com/a.png",
                "is_following": False,
            },
        )

    def test_ordered_newest_follow_first(self):
        old = User.objects.create(username="old")
        new = User.objects.create(username="new")
        self._follow(old, self.target, age_minutes=60)
        self._follow(new, self.target, age_minutes=1)

        response = self._get(self.target.id, self.viewer)

        self.assertEqual([r["username"] for r in response.data["results"]], ["new", "old"])

    def test_pagination_second_page(self):
        self._make_followers(12)

        page1 = self._get(self.target.id, self.viewer)
        page2 = self._get(self.target.id, self.viewer, "?page=2")

        self.assertEqual(page1.data["count"], 12)
        self.assertEqual(len(page1.data["results"]), 10)
        self.assertIsNotNone(page1.data["next"])
        self.assertEqual(len(page2.data["results"]), 2)
        self.assertIsNone(page2.data["next"])

    def test_is_following_is_relative_to_the_viewer(self):
        a, b = User.objects.create(username="a"), User.objects.create(username="b")
        self._follow(a, self.target, age_minutes=2)
        self._follow(b, self.target, age_minutes=1)
        self._follow(self.viewer, a)

        response = self._get(self.target.id, self.viewer)
        flags = {r["username"]: r["is_following"] for r in response.data["results"]}

        self.assertEqual(flags, {"a": True, "b": False})

    def test_viewers_own_row_is_not_following(self):
        self._follow(self.viewer, self.target)

        response = self._get(self.target.id, self.viewer)

        self.assertFalse(response.data["results"][0]["is_following"])

    def test_query_count_is_constant_in_row_count(self):
        self._make_followers(2)
        with self.assertNumQueries(3):
            self._get(self.target.id, self.viewer)

        # bulk_create skips the profile signal, so this also covers users with no profile
        extra = User.objects.bulk_create([User(username=f"x{i}") for i in range(8)])
        for user in extra:
            self._follow(user, self.target)
        with self.assertNumQueries(3):
            self._get(self.target.id, self.viewer)


class FollowingListTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.view = FollowingList.as_view()
        self.target = User.objects.create(username="target")
        self.viewer = User.objects.create(username="viewer")

    def _get(self, user_id, viewer=None, query=""):
        request = self.factory.get(f"/api/users/{user_id}/following/{query}")
        if viewer is not None:
            force_authenticate(request, user=viewer)
        return self.view(request, user_id=user_id)

    def _follow(self, follower, followee, age_minutes=0):
        follow = Follow.objects.create(follower=follower, followee=followee)
        Follow.objects.filter(pk=follow.pk).update(
            created_at=timezone.now() - timedelta(minutes=age_minutes)
        )

    def test_unauthenticated_is_rejected(self):
        self.assertIn(self._get(self.target.id).status_code, (401, 403))

    def test_unknown_user_is_404(self):
        self.assertEqual(self._get(999999, self.viewer).status_code, 404)

    def test_lists_only_who_the_user_follows_with_expected_fields(self):
        a = User.objects.create(username="a", email="a@example.com")
        a.profile.imageUrl = "https://img.example.com/a.png"
        a.profile.save()
        stranger = User.objects.create(username="stranger")
        self._follow(self.target, a)
        self._follow(stranger, self.target)  # a follower, not someone target follows

        response = self._get(self.target.id, self.viewer)

        self.assertEqual(response.data["count"], 1)
        self.assertEqual(
            response.data["results"][0],
            {
                "id": a.id,
                "username": "a",
                "imageUrl": "https://img.example.com/a.png",
                "is_following": False,
            },
        )

    def test_ordered_newest_follow_first(self):
        old = User.objects.create(username="old")
        new = User.objects.create(username="new")
        self._follow(self.target, old, age_minutes=60)
        self._follow(self.target, new, age_minutes=1)

        response = self._get(self.target.id, self.viewer)

        self.assertEqual([r["username"] for r in response.data["results"]], ["new", "old"])

    def test_pagination_second_page(self):
        for i in range(12):
            self._follow(self.target, User.objects.create(username=f"f{i}"), age_minutes=i)

        page1 = self._get(self.target.id, self.viewer)
        page2 = self._get(self.target.id, self.viewer, "?page=2")

        self.assertEqual(page1.data["count"], 12)
        self.assertEqual(len(page1.data["results"]), 10)
        self.assertIsNotNone(page1.data["next"])
        self.assertEqual(len(page2.data["results"]), 2)
        self.assertIsNone(page2.data["next"])

    def test_is_following_is_relative_to_the_viewer(self):
        a, b = User.objects.create(username="a"), User.objects.create(username="b")
        self._follow(self.target, a, age_minutes=2)
        self._follow(self.target, b, age_minutes=1)
        self._follow(self.viewer, a)

        response = self._get(self.target.id, self.viewer)
        flags = {r["username"]: r["is_following"] for r in response.data["results"]}

        self.assertEqual(flags, {"a": True, "b": False})

    def test_viewers_own_row_is_not_following(self):
        self._follow(self.target, self.viewer)

        response = self._get(self.target.id, self.viewer)

        self.assertFalse(response.data["results"][0]["is_following"])

    def test_query_count_is_constant_in_row_count(self):
        for i in range(2):
            self._follow(self.target, User.objects.create(username=f"f{i}"))
        with self.assertNumQueries(3):
            self._get(self.target.id, self.viewer)

        for user in User.objects.bulk_create([User(username=f"x{i}") for i in range(8)]):
            self._follow(self.target, user)
        with self.assertNumQueries(3):
            self._get(self.target.id, self.viewer)
