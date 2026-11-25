"""Tests for GET /api/users/search/. ClerkAuthentication is bypassed with force_authenticate."""
from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIRequestFactory, force_authenticate

from movie_csv.views.api import UserSearch
from users.models import Follow

User = get_user_model()


def _make_user(clerk_id, display_username=None):
    """A user whose Profile carries a Clerk username (as ClerkAuthentication stores it)."""
    user = User.objects.create(username=clerk_id)
    if display_username:
        user.profile.display_username = display_username
        user.profile.save()
    return user


class UserSearchTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.me = _make_user("user_2meClerkId", "me_handle")

    def _get(self, q=None, viewer="me", page=None):
        params = {}
        if q is not None:
            params["q"] = q
        if page is not None:
            params["page"] = page
        request = self.factory.get("/api/users/search/", params)
        if viewer == "me":
            force_authenticate(request, user=self.me)
        elif viewer is not None:
            force_authenticate(request, user=viewer)
        return UserSearch.as_view()(request)

    def _names(self, response):
        return [row["username"] for row in response.data["results"]]

    def test_unauthenticated_is_rejected(self):
        _make_user("user_2aClerkId", "filmfan")
        self.assertIn(self._get("film", viewer=None).status_code, (401, 403))

    def test_matches_a_case_insensitive_substring(self):
        _make_user("user_2aClerkId", "FilmFan")
        _make_user("user_2bClerkId", "the_film_critic")
        _make_user("user_2cClerkId", "unrelated")
        response = self._get("FILM")
        self.assertEqual(response.status_code, 200)
        self.assertCountEqual(self._names(response), ["FilmFan", "the_film_critic"])

    def test_orders_exact_then_prefix_then_most_followed_then_id(self):
        contains = _make_user("user_2aClerkId", "big_film")
        _make_user("user_2bClerkId", "filmbuff")
        exact = _make_user("user_2cClerkId", "film")
        popular_prefix = _make_user("user_2dClerkId", "filmnerd")
        fan = _make_user("user_2eClerkId", "fan_handle")
        Follow.objects.create(follower=fan, followee=popular_prefix)
        Follow.objects.create(follower=fan, followee=contains)
        response = self._get("film")
        self.assertEqual(
            self._names(response), ["film", "filmnerd", "filmbuff", "big_film"]
        )
        self.assertEqual(response.data["results"][0]["id"], exact.id)

    def test_exact_match_ignores_case(self):
        _make_user("user_2aClerkId", "filmfan")
        exact = _make_user("user_2bClerkId", "Film")
        response = self._get("film")
        self.assertEqual(response.data["results"][0]["id"], exact.id)

    def test_excludes_the_viewer(self):
        _make_user("user_2aClerkId", "me_handle_two")
        response = self._get("me_handle")
        self.assertEqual(self._names(response), ["me_handle_two"])

    def test_users_without_a_display_username_are_not_searchable(self):
        _make_user("user_2filmClerkId")  # username is the Clerk id; no display name
        blank = User.objects.create(username="user_2blankClerkId")
        blank.profile.display_username = ""
        blank.profile.save()
        response = self._get("film")
        self.assertEqual(response.data["results"], [])
        response = self._get("user_2")
        self.assertEqual(response.data["results"], [])

    def test_is_following_is_relative_to_the_viewer(self):
        followed = _make_user("user_2aClerkId", "film_followed")
        _make_user("user_2bClerkId", "film_stranger")
        Follow.objects.create(follower=self.me, followee=followed)
        rows = {row["username"]: row for row in self._get("film").data["results"]}
        self.assertTrue(rows["film_followed"]["is_following"])
        self.assertFalse(rows["film_stranger"]["is_following"])

    def test_payload_has_only_the_list_fields_and_never_the_clerk_id(self):
        _make_user("user_2secretClerkId", "filmfan")
        response = self._get("film")
        self.assertEqual(
            set(response.data["results"][0]), {"id", "username", "imageUrl", "is_following"}
        )
        self.assertNotIn("user_2secretClerkId", str(response.data))

    def test_missing_blank_and_one_character_queries_return_an_empty_page(self):
        _make_user("user_2aClerkId", "filmfan")
        for q in (None, "", "   ", "f", " f "):
            response = self._get(q)
            self.assertEqual(response.status_code, 200, q)
            self.assertEqual(response.data["results"], [], q)
            self.assertEqual(response.data["count"], 0, q)

    def test_the_query_is_trimmed(self):
        _make_user("user_2aClerkId", "filmfan")
        self.assertEqual(self._names(self._get("  film  ")), ["filmfan"])

    def test_percent_and_underscore_are_literal(self):
        _make_user("user_2aClerkId", "a_b_user")
        _make_user("user_2bClerkId", "axbxuser")
        _make_user("user_2cClerkId", "100%_real")
        self.assertEqual(self._names(self._get("a_b")), ["a_b_user"])
        self.assertEqual(self._names(self._get("0%")), ["100%_real"])
        self.assertEqual(self._get("%%").data["results"], [])

    def test_pagination_is_stable_and_complete(self):
        for i in range(25):
            _make_user(f"user_2c{i:02d}ClerkId", f"film{i:02d}")
        first = self._get("film")
        self.assertEqual(first.data["count"], 25)
        self.assertEqual(len(first.data["results"]), 10)
        self.assertIsNotNone(first.data["next"])
        seen = []
        for page in (1, 2, 3):
            seen += [row["id"] for row in self._get("film", page=page).data["results"]]
        self.assertEqual(len(seen), 25)
        self.assertEqual(len(set(seen)), 25)

    def test_query_count_does_not_grow_with_the_number_of_results(self):
        for i in range(3):
            _make_user(f"user_2a{i}ClerkId", f"film_small{i}")
        with CaptureQueriesContext(connection) as small:
            self._get("film")
        for i in range(7):
            _make_user(f"user_2b{i}ClerkId", f"film_more{i}")
        with CaptureQueriesContext(connection) as large:
            response = self._get("film")
        self.assertEqual(len(response.data["results"]), 10)
        self.assertEqual(len(large), len(small))
