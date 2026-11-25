"""Tests for the followers list endpoint (GET /api/users/<id>/followers/).

ClerkAuthentication is bypassed with DRF's force_authenticate.
"""
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from movie_csv.views.api import FollowersList, FollowingList, FollowUser, RemoveFollower
from users.models import Follow

User = get_user_model()


def _make_user(username, display_username=True, **kwargs):
    """Create a user whose Profile carries a Clerk username (as ClerkAuthentication stores it)."""
    user = User.objects.create(username=username, **kwargs)
    if display_username:
        user.profile.display_username = username
        user.profile.save()
    return user


class FollowersListTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.view = FollowersList.as_view()
        self.target = _make_user(username="target")
        self.viewer = _make_user(username="viewer")

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
        users = [_make_user(username=f"f{i}") for i in range(n)]
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
        a = _make_user(username="a", email="a@example.com")
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
        old = _make_user(username="old")
        new = _make_user(username="new")
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
        a, b = _make_user(username="a"), _make_user(username="b")
        self._follow(a, self.target, age_minutes=2)
        self._follow(b, self.target, age_minutes=1)
        self._follow(self.viewer, a)

        response = self._get(self.target.id, self.viewer)
        flags = {r["username"]: r["is_following"] for r in response.data["results"]}

        self.assertEqual(flags, {"a": True, "b": False})

    def test_shows_display_username_not_the_clerk_id(self):
        clerk_user = User.objects.create(username="user_2abcClerkId")
        clerk_user.profile.display_username = "hillary"
        clerk_user.profile.save()
        self._follow(clerk_user, self.target)

        response = self._get(self.target.id, self.viewer)

        self.assertEqual(response.data["results"][0]["username"], "hillary")

    def test_user_without_display_username_shows_anonymous(self):
        no_name = _make_user("user_2abcClerkId", display_username=False)
        self._follow(no_name, self.target)

        response = self._get(self.target.id, self.viewer)

        self.assertEqual(response.data["results"][0]["username"], "Anonymous")

    def test_query_count_does_not_grow_with_rows(self):
        self._make_followers(2)
        with CaptureQueriesContext(connection) as small:
            self._get(self.target.id, self.viewer)
        for i in range(8):
            self._follow(_make_user(f"extra{i}"), self.target)
        with CaptureQueriesContext(connection) as large:
            self._get(self.target.id, self.viewer)
        self.assertEqual(len(small), len(large))

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
        self.target = _make_user(username="target")
        self.viewer = _make_user(username="viewer")

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
        a = _make_user(username="a", email="a@example.com")
        a.profile.imageUrl = "https://img.example.com/a.png"
        a.profile.save()
        stranger = _make_user(username="stranger")
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
        old = _make_user(username="old")
        new = _make_user(username="new")
        self._follow(self.target, old, age_minutes=60)
        self._follow(self.target, new, age_minutes=1)

        response = self._get(self.target.id, self.viewer)

        self.assertEqual([r["username"] for r in response.data["results"]], ["new", "old"])

    def test_pagination_second_page(self):
        for i in range(12):
            self._follow(self.target, _make_user(username=f"f{i}"), age_minutes=i)

        page1 = self._get(self.target.id, self.viewer)
        page2 = self._get(self.target.id, self.viewer, "?page=2")

        self.assertEqual(page1.data["count"], 12)
        self.assertEqual(len(page1.data["results"]), 10)
        self.assertIsNotNone(page1.data["next"])
        self.assertEqual(len(page2.data["results"]), 2)
        self.assertIsNone(page2.data["next"])

    def test_is_following_is_relative_to_the_viewer(self):
        a, b = _make_user(username="a"), _make_user(username="b")
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
            self._follow(self.target, _make_user(username=f"f{i}"))
        with self.assertNumQueries(3):
            self._get(self.target.id, self.viewer)

        for user in User.objects.bulk_create([User(username=f"x{i}") for i in range(8)]):
            self._follow(self.target, user)
        with self.assertNumQueries(3):
            self._get(self.target.id, self.viewer)


class RemoveFollowerTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.owner = _make_user(username="owner")
        self.fan = _make_user(username="fan")
        self.other = _make_user(username="other")

    def _delete(self, actor, user_id, follower_id):
        request = self.factory.delete(f"/api/users/{user_id}/followers/{follower_id}/")
        if actor is not None:
            force_authenticate(request, user=actor)
        return RemoveFollower.as_view()(request, user_id=user_id, follower_id=follower_id)

    def _toggle_follow(self, actor, target_id):
        request = self.factory.post(f"/api/users/{target_id}/follow/")
        force_authenticate(request, user=actor)
        return FollowUser.as_view()(request, user_id=target_id)

    def test_unauthenticated_is_rejected(self):
        Follow.objects.create(follower=self.fan, followee=self.owner)
        response = self._delete(None, self.owner.id, self.fan.id)
        self.assertIn(response.status_code, (401, 403))
        self.assertTrue(Follow.objects.filter(follower=self.fan, followee=self.owner).exists())

    def test_owner_removes_a_follower(self):
        Follow.objects.create(follower=self.fan, followee=self.owner)

        response = self._delete(self.owner, self.owner.id, self.fan.id)

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Follow.objects.filter(follower=self.fan, followee=self.owner).exists())

    def test_removal_only_touches_that_follow(self):
        Follow.objects.create(follower=self.fan, followee=self.owner)
        Follow.objects.create(follower=self.other, followee=self.owner)
        Follow.objects.create(follower=self.owner, followee=self.fan)  # owner still follows fan

        self._delete(self.owner, self.owner.id, self.fan.id)

        self.assertEqual(Follow.objects.count(), 2)
        self.assertTrue(Follow.objects.filter(follower=self.owner, followee=self.fan).exists())

    def test_another_user_cannot_remove_and_the_follow_survives(self):
        Follow.objects.create(follower=self.fan, followee=self.owner)

        response = self._delete(self.other, self.owner.id, self.fan.id)

        self.assertEqual(response.status_code, 403)
        self.assertTrue(Follow.objects.filter(follower=self.fan, followee=self.owner).exists())

    def test_the_follower_cannot_remove_themselves_this_way(self):
        Follow.objects.create(follower=self.fan, followee=self.owner)

        response = self._delete(self.fan, self.owner.id, self.fan.id)

        self.assertEqual(response.status_code, 403)

    def test_no_such_follow_is_404(self):
        response = self._delete(self.owner, self.owner.id, self.fan.id)
        self.assertEqual(response.status_code, 404)

    def test_removing_twice_is_404_the_second_time(self):
        Follow.objects.create(follower=self.fan, followee=self.owner)
        self._delete(self.owner, self.owner.id, self.fan.id)

        self.assertEqual(self._delete(self.owner, self.owner.id, self.fan.id).status_code, 404)

    def test_removed_follower_can_follow_again(self):
        Follow.objects.create(follower=self.fan, followee=self.owner)
        self._delete(self.owner, self.owner.id, self.fan.id)

        response = self._toggle_follow(self.fan, self.owner.id)

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["following"])
        self.assertTrue(Follow.objects.filter(follower=self.fan, followee=self.owner).exists())

    def test_removal_is_reflected_in_the_followers_list(self):
        Follow.objects.create(follower=self.fan, followee=self.owner)
        self._delete(self.owner, self.owner.id, self.fan.id)

        request = self.factory.get(f"/api/users/{self.owner.id}/followers/")
        force_authenticate(request, user=self.owner)
        response = FollowersList.as_view()(request, user_id=self.owner.id)

        self.assertEqual(response.data["count"], 0)
