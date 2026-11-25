"""Watchlists are private: no collection endpoint hands one to anyone but its owner.

`GET /api/collections/` used to be anonymous and return every collection, watchlists included,
and `GET /api/collections/<uuid>/` served another user's watchlist to any signed-in user who
had the UUID. ClerkAuthentication is bypassed with DRF's force_authenticate.
"""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from movie_csv.models import Collection
from movie_csv.views.api import CollectionDetail, CollectionList, public_collections

User = get_user_model()


def _make_user(clerk_id, display_username=None):
    user = User.objects.create(username=clerk_id)
    if display_username:
        user.profile.display_username = display_username
        user.profile.save()
    return user


class CollectionPrivacyTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.me = _make_user("user_2meClerkId", "me_handle")
        self.friend = _make_user("user_2friendClerkId", "friend_handle")
        self.my_watchlist = Collection.objects.create(name="Watchlist", owner=self.me, is_watchlist=True)
        self.their_watchlist = Collection.objects.create(name="Watchlist", owner=self.friend, is_watchlist=True)
        # a watchlist still carrying the legacy "<clerk id>'s Watchlist" name, flagged by migration 0011
        self.pal = _make_user("user_2palClerkId", "pal_handle")
        self.legacy_named = Collection.objects.create(
            name="user_2palClerkId's Watchlist", owner=self.pal, is_watchlist=True
        )
        self.mine = Collection.objects.create(name="Mine", owner=self.me)
        self.theirs = Collection.objects.create(name="Theirs", owner=self.friend)

    def _call(self, view, viewer=None, **kwargs):
        request = self.factory.get("/api/anything/")
        if viewer is not None:
            force_authenticate(request, user=viewer)
        return view(request, **kwargs)

    def _list_ids(self, viewer):
        """public_ids as strings: the serializer emits str, the model holds UUID."""
        response = self._call(CollectionList.as_view(), viewer)
        self.assertEqual(response.status_code, 200)
        return {str(row["public_id"]) for row in response.data["results"]}

    # --- helper ----------------------------------------------------------------

    def test_public_collections_is_every_collection_that_is_not_a_watchlist(self):
        self.assertCountEqual(list(public_collections()), [self.mine, self.theirs])

    # --- GET /api/collections/ -------------------------------------------------

    def test_list_has_no_watchlist_for_an_anonymous_viewer(self):
        ids = self._list_ids(None)
        self.assertEqual(ids, {str(self.mine.public_id), str(self.theirs.public_id)})

    def test_list_has_no_watchlist_for_another_user(self):
        ids = self._list_ids(self.me)
        for watchlist in (self.their_watchlist, self.legacy_named):
            self.assertNotIn(str(watchlist.public_id), ids)

    def test_list_has_no_watchlist_even_for_its_owner(self):
        self.assertNotIn(str(self.my_watchlist.public_id), self._list_ids(self.me))

    def test_list_still_returns_ordinary_lists(self):
        self.assertEqual(self._list_ids(self.friend), {str(self.mine.public_id), str(self.theirs.public_id)})

    # --- GET /api/collections/<uuid>/ ------------------------------------------

    def _detail(self, collection, viewer):
        return self._call(CollectionDetail.as_view(), viewer, public_id=collection.public_id)

    def test_detail_404s_for_another_users_watchlist(self):
        for watchlist in (self.their_watchlist, self.legacy_named):
            self.assertEqual(self._detail(watchlist, self.me).status_code, 404)

    def test_detail_serves_a_watchlist_to_its_owner(self):
        response = self._detail(self.my_watchlist, self.me)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["is_watchlist"])
        self.assertTrue(response.data["is_owner"])

    def test_detail_still_serves_another_users_ordinary_list(self):
        response = self._detail(self.theirs, self.me)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["is_owner"])

    def test_a_404_does_not_reveal_that_the_watchlist_exists(self):
        missing = self._call(CollectionDetail.as_view(), self.me, public_id="00000000-0000-4000-8000-000000000000")
        hidden = self._detail(self.their_watchlist, self.me)
        self.assertEqual(hidden.status_code, missing.status_code)
        self.assertEqual(hidden.data, missing.data)


class CollectionDetailWriteTests(TestCase):
    """Only the owner may change or delete a list through `/api/collections/<uuid>/`.

    The view was a RetrieveUpdateDestroyAPIView guarded only by IsAuthenticated, so any signed-in
    user could rename or delete anyone's list by UUID. Reads stay open for ordinary lists.
    """

    def setUp(self):
        self.factory = APIRequestFactory()
        self.me = _make_user("user_2meClerkId", "me_handle")
        self.friend = _make_user("user_2friendClerkId", "friend_handle")
        self.mine = Collection.objects.create(name="Mine", description="keep", owner=self.me)

    def _write(self, method, viewer, data=None):
        request = getattr(self.factory, method)("/api/anything/", data, format="json")
        if viewer is not None:
            force_authenticate(request, user=viewer)
        return CollectionDetail.as_view()(request, public_id=self.mine.public_id)

    def test_a_non_owner_cannot_rename_a_list(self):
        for method in ("patch", "put"):
            response = self._write(method, self.friend, {"name": "Hijacked", "description": "x"})
            self.assertEqual(response.status_code, 403, method)
        self.mine.refresh_from_db()
        self.assertEqual((self.mine.name, self.mine.description), ("Mine", "keep"))

    def test_a_non_owner_cannot_delete_a_list(self):
        self.assertEqual(self._write("delete", self.friend).status_code, 403)
        self.assertTrue(Collection.objects.filter(pk=self.mine.pk).exists())

    def test_an_anonymous_user_cannot_write(self):
        for method in ("patch", "delete"):
            self.assertIn(self._write(method, None, {"name": "x"}).status_code, (401, 403), method)
        self.mine.refresh_from_db()
        self.assertEqual(self.mine.name, "Mine")

    def test_the_owner_can_rename_and_delete_their_list(self):
        renamed = self._write("patch", self.me, {"name": "Renamed"})
        self.assertEqual(renamed.status_code, 200)
        self.assertEqual(renamed.data["name"], "Renamed")
        self.assertEqual(self._write("delete", self.me).status_code, 204)
        self.assertFalse(Collection.objects.filter(pk=self.mine.pk).exists())

    def test_anyone_signed_in_can_still_read_an_ordinary_list(self):
        request = self.factory.get("/api/anything/")
        force_authenticate(request, user=self.friend)
        response = CollectionDetail.as_view()(request, public_id=self.mine.public_id)
        self.assertEqual(response.status_code, 200)
