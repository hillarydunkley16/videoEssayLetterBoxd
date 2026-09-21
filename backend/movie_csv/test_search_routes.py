"""The search endpoints as a client reaches them: through the URL router and the real auth stack.

The other search tests call the views directly; these prove the routes are registered, are not
swallowed by a neighbouring `<uuid>` / `<int>` pattern, and reject callers without a Clerk token.
"""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient

from movie_csv.models import Collection

User = get_user_model()


def _make_user(clerk_id, display_username):
    user = User.objects.create(username=clerk_id)
    user.profile.display_username = display_username
    user.profile.save()
    return user


class SearchRouteTests(TestCase):
    def setUp(self):
        self.me = _make_user("user_2meClerkId", "me_handle")
        self.friend = _make_user("user_2friendClerkId", "film_friend")
        Collection.objects.create(name="Film picks", owner=self.friend)
        Collection.objects.create(name="Film watchlist", owner=self.friend, is_watchlist=True)
        self.client = APIClient()

    def test_both_routes_reject_a_request_without_a_token(self):
        for url in ("/api/users/search/?q=film", "/api/collections/search/?q=film"):
            self.assertIn(self.client.get(url).status_code, (401, 403), url)

    def test_both_routes_reject_a_bad_token(self):
        self.client.credentials(HTTP_AUTHORIZATION="Bearer not-a-real-jwt")
        for url in ("/api/users/search/?q=film", "/api/collections/search/?q=film"):
            self.assertIn(self.client.get(url).status_code, (401, 403), url)

    def test_user_search_is_routed_and_returns_people(self):
        self.client.force_authenticate(self.me)
        response = self.client.get("/api/users/search/", {"q": "film"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual([row["username"] for row in response.json()["results"]], ["film_friend"])

    def test_list_search_is_routed_and_never_returns_a_watchlist(self):
        self.client.force_authenticate(self.me)
        response = self.client.get("/api/collections/search/", {"q": "film"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual([row["name"] for row in response.json()["results"]], ["Film picks"])

    def test_the_watchlist_is_absent_from_every_collection_listing(self):
        for url in ("/api/collections/", "/api/collections/search/?q=film"):
            self.client.force_authenticate(self.me)
            body = self.client.get(url).json()
            self.assertFalse(any(row["is_watchlist"] for row in body["results"]), url)
        self.client.force_authenticate(None)  # anonymous, where the list endpoint is open
        body = self.client.get("/api/collections/").json()
        self.assertFalse(any(row["is_watchlist"] for row in body["results"]))
