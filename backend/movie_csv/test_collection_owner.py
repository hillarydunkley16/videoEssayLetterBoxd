"""Collection owners show Clerk usernames, and collections know whether the viewer owns them.

`owner` used to be the Django username (= Clerk sub), which the frontend compared to the
Clerk user id to decide whether to show edit/delete. That comparison can't survive showing a
display name, so the backend now says `is_owner` itself. ClerkAuthentication is bypassed with
DRF's force_authenticate.
"""
from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIRequestFactory, force_authenticate

from movie_csv.models import Collection, VideoEssay
from movie_csv.serializers import CollectionSerializer, ProfileSerializer
from movie_csv.views.api import CollectionByUser, CollectionDetail, CollectionList

User = get_user_model()


def _make_user(clerk_id, display_username=None):
    user = User.objects.create(username=clerk_id)
    if display_username:
        user.profile.display_username = display_username
        user.profile.save()
    return user


class CollectionOwnerTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.me = _make_user("user_2meClerkId", "me_handle")
        self.friend = _make_user("user_2friendClerkId", "friend_handle")
        self.anon = _make_user("user_2anonClerkId")
        self.mine = Collection.objects.create(name="Mine", owner=self.me)
        self.theirs = Collection.objects.create(name="Theirs", owner=self.friend)

    def _call(self, view, viewer=None, **kwargs):
        request = self.factory.get("/api/anything/")
        if viewer is not None:
            force_authenticate(request, user=viewer)
        return view(request, **kwargs)

    def _rows(self, response):
        data = response.data
        return data["results"] if isinstance(data, dict) and "results" in data else data

    def test_owner_is_the_display_username_not_the_clerk_id(self):
        rows = {r["name"]: r["owner"] for r in self._rows(self._call(CollectionList.as_view(), self.me))}
        self.assertEqual(rows, {"Mine": "me_handle", "Theirs": "friend_handle"})

    def test_owner_without_display_username_is_anonymous(self):
        Collection.objects.create(name="Nameless", owner=self.anon)
        rows = {r["name"]: r["owner"] for r in self._rows(self._call(CollectionList.as_view(), self.me))}
        self.assertEqual(rows["Nameless"], "Anonymous")

    def test_is_owner_is_relative_to_the_viewer(self):
        rows = {r["name"]: r["is_owner"] for r in self._rows(self._call(CollectionList.as_view(), self.me))}
        self.assertEqual(rows, {"Mine": True, "Theirs": False})

    def test_is_owner_is_false_for_anonymous_viewers(self):
        rows = self._rows(self._call(CollectionList.as_view(), None))
        self.assertTrue(rows)
        self.assertFalse(any(r["is_owner"] for r in rows))

    def test_detail_is_owner_for_the_owner_only(self):
        as_owner = self._call(CollectionDetail.as_view(), self.me, public_id=self.mine.public_id)
        as_other = self._call(CollectionDetail.as_view(), self.friend, public_id=self.mine.public_id)
        self.assertTrue(as_owner.data["is_owner"])
        self.assertFalse(as_other.data["is_owner"])
        self.assertEqual(as_other.data["owner"], "me_handle")

    def test_by_user_lists_are_all_owned_by_the_viewer(self):
        rows = self._rows(self._call(CollectionByUser.as_view(), self.me))
        self.assertEqual([r["name"] for r in rows], ["Mine"])
        self.assertTrue(rows[0]["is_owner"])

    def test_serializer_without_a_request_says_not_owner(self):
        self.assertFalse(CollectionSerializer(self.mine).data["is_owner"])

    def test_the_clerk_id_is_not_exposed(self):
        row = self._rows(self._call(CollectionList.as_view(), self.friend))[0]
        self.assertNotIn("user_2", str(row))

    # --- watchlist: naming is deliberately untouched ------------------------

    def _profile_data(self, profile_user, viewer):
        request = self.factory.get("/api/anything/")
        force_authenticate(request, user=viewer)
        request.user = viewer
        return ProfileSerializer(profile_user.profile, context={"request": request}).data

    def test_profile_watchlist_carries_is_owner(self):
        own = self._profile_data(self.me, self.me)["watchList"]
        seen_by_other = self._profile_data(self.me, self.friend)["watchList"]
        self.assertTrue(own["is_owner"])
        self.assertFalse(seen_by_other["is_owner"])
        self.assertEqual(own["owner"], "me_handle")

    def test_watchlist_name_and_lookup_are_unchanged_so_no_duplicates(self):
        self._profile_data(self.me, self.me)
        self._profile_data(self.me, self.friend)
        watchlists = Collection.objects.filter(owner=self.me, name="user_2meClerkId's Watchlist")
        self.assertEqual(watchlists.count(), 1)

    # --- query counts -----------------------------------------------------

    def _add_collections(self, n, start=0):
        essay = VideoEssay.objects.create(title="E", owner=self.friend)
        for i in range(start, start + n):
            collection = Collection.objects.create(name=f"c{i}", owner=_make_user(f"user_o{i}", f"owner{i}"))
            collection.essays.add(essay)

    def _query_count(self):
        with CaptureQueriesContext(connection) as ctx:
            self._call(CollectionList.as_view(), self.me)
        return len(ctx)

    def test_list_query_count_does_not_grow_with_rows(self):
        self._add_collections(2)
        small = self._query_count()
        self._add_collections(6, start=2)
        self.assertEqual(small, self._query_count())
