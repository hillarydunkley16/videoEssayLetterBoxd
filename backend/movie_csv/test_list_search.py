"""Tests for GET /api/collections/search/. ClerkAuthentication is bypassed with force_authenticate.

Lists are matched by name only, and a watchlist is never a result (see test_collection_privacy.py).
"""
from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIRequestFactory, force_authenticate

from movie_csv.models import Collection, VideoEssay
from movie_csv.views.api import CollectionSearch

User = get_user_model()


def _make_user(clerk_id, display_username=None):
    user = User.objects.create(username=clerk_id)
    if display_username:
        user.profile.display_username = display_username
        user.profile.save()
    return user


class ListSearchTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.me = _make_user("user_2meClerkId", "me_handle")
        self.friend = _make_user("user_2friendClerkId", "friend_handle")

    def _get(self, q=None, viewer="me", page=None):
        params = {}
        if q is not None:
            params["q"] = q
        if page is not None:
            params["page"] = page
        request = self.factory.get("/api/collections/search/", params)
        if viewer == "me":
            force_authenticate(request, user=self.me)
        elif viewer is not None:
            force_authenticate(request, user=viewer)
        return CollectionSearch.as_view()(request)

    def _names(self, response):
        return [row["name"] for row in response.data["results"]]

    def _list(self, name, owner=None, essays=0):
        collection = Collection.objects.create(name=name, owner=owner or self.friend)
        for i in range(essays):
            collection.essays.add(VideoEssay.objects.create(title=f"{name} essay {i}", owner=self.friend))
        return collection

    def test_unauthenticated_is_rejected(self):
        self._list("Film essays")
        self.assertIn(self._get("film", viewer=None).status_code, (401, 403))

    def test_matches_a_case_insensitive_substring_of_the_name(self):
        self._list("Film Essays")
        self._list("best film ever")
        self._list("Cooking")
        response = self._get("FILM")
        self.assertEqual(response.status_code, 200)
        self.assertCountEqual(self._names(response), ["Film Essays", "best film ever"])

    def test_only_the_name_is_searched_not_the_description_or_owner(self):
        Collection.objects.create(name="Unrelated", description="all about film", owner=self.friend)
        self._list("Also unrelated", owner=_make_user("user_2filmClerkId", "film_buff"))
        self.assertEqual(self._get("film").data["results"], [])

    def test_orders_exact_then_prefix_then_most_essays_then_id(self):
        contains = self._list("big film", essays=3)
        few = self._list("filmy", essays=1)
        many = self._list("film school", essays=2)
        exact = self._list("Film", essays=0)
        response = self._get("film")
        self.assertEqual(
            [row["public_id"] for row in response.data["results"]],
            [str(exact.public_id), str(many.public_id), str(few.public_id), str(contains.public_id)],
        )

    def test_a_watchlist_is_never_returned(self):
        Collection.objects.create(name="Film watchlist", owner=self.me, is_watchlist=True)
        Collection.objects.create(name="Film watchlist", owner=self.friend, is_watchlist=True)
        pal = _make_user("user_2filmpalClerkId", "pal_handle")
        Collection.objects.create(name="user_2filmpalClerkId's Watchlist", owner=pal, is_watchlist=True)
        ordinary = self._list("Film picks")
        for viewer in (self.me, self.friend, pal):
            response = self._get("film", viewer=viewer)
            self.assertEqual(
                [row["public_id"] for row in response.data["results"]], [str(ordinary.public_id)]
            )
        # the legacy Clerk-id-named row is not findable by its stored name either
        self.assertEqual(self._get("user_2filmpal").data["results"], [])

    def test_shows_the_display_username_never_the_clerk_id(self):
        self._list("Film picks")
        self._list("Film nameless", owner=_make_user("user_2anonClerkId"))
        rows = {row["name"]: row["owner"] for row in self._get("film").data["results"]}
        self.assertEqual(rows, {"Film picks": "friend_handle", "Film nameless": "Anonymous"})
        self.assertNotIn("user_2", str(self._get("film").data))

    def test_marks_the_viewers_own_lists(self):
        self._list("Film mine", owner=self.me)
        self._list("Film theirs")
        rows = {row["name"]: row["is_owner"] for row in self._get("film").data["results"]}
        self.assertEqual(rows, {"Film mine": True, "Film theirs": False})

    def test_missing_blank_and_one_character_queries_return_an_empty_page(self):
        self._list("Film essays")
        for q in (None, "", "   ", "f", " f "):
            response = self._get(q)
            self.assertEqual(response.status_code, 200, q)
            self.assertEqual(response.data["results"], [], q)
            self.assertEqual(response.data["count"], 0, q)

    def test_the_query_is_trimmed(self):
        self._list("Film essays")
        self.assertEqual(self._names(self._get("  film  ")), ["Film essays"])

    def test_percent_and_underscore_are_literal(self):
        self._list("a_b list")
        self._list("axb list")
        self._list("100% real")
        self.assertEqual(self._names(self._get("a_b")), ["a_b list"])
        self.assertEqual(self._names(self._get("0%")), ["100% real"])
        self.assertEqual(self._get("%%").data["results"], [])

    def test_pagination_is_stable_and_complete(self):
        for i in range(25):
            self._list(f"film {i:02d}")
        first = self._get("film")
        self.assertEqual(first.data["count"], 25)
        self.assertEqual(len(first.data["results"]), 10)
        self.assertIsNotNone(first.data["next"])
        seen = []
        for page in (1, 2, 3):
            seen += [row["public_id"] for row in self._get("film", page=page).data["results"]]
        self.assertEqual(len(seen), 25)
        self.assertEqual(len(set(seen)), 25)

    def test_query_count_does_not_grow_with_the_number_of_results(self):
        for i in range(3):
            self._list(f"film small {i}", owner=_make_user(f"user_2s{i}ClerkId", f"small{i}"), essays=2)
        with CaptureQueriesContext(connection) as small:
            self._get("film")
        for i in range(7):
            self._list(f"film more {i}", owner=_make_user(f"user_2m{i}ClerkId", f"more{i}"), essays=2)
        with CaptureQueriesContext(connection) as large:
            response = self._get("film")
        self.assertEqual(len(response.data["results"]), 10)
        self.assertEqual(len(large), len(small))
