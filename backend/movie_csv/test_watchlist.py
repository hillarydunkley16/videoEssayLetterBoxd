"""Watchlists are found and protected by `is_watchlist`, and titled from the display username.

They used to be found by the name "<username>'s Watchlist" (username being the Clerk id), which
leaked the Clerk id into the page title, allowed duplicates, and made `RemoveCollection` refuse to
delete any list with "Watchlist" anywhere in its name. ClerkAuthentication is bypassed with DRF's
force_authenticate.
"""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from movie_csv.models import Collection, VideoEssay
from movie_csv.serializers import ProfileSerializer
from movie_csv.views.api import CollectionDetail, CollectionList, RemoveCollection

User = get_user_model()


def _make_user(clerk_id, display_username=None):
    user = User.objects.create(username=clerk_id)
    if display_username:
        user.profile.display_username = display_username
        user.profile.save()
    return user


class WatchlistTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.me = _make_user("user_2meClerkId", "hillary")
        self.friend = _make_user("user_2friendClerkId", "sam")
        self.anon = _make_user("user_2anonClerkId")

    def _profile_watchlist(self, profile_user, viewer=None):
        request = self.factory.get("/api/anything/")
        request.user = viewer or profile_user
        context = {"request": request}
        return ProfileSerializer(profile_user.profile, context=context).data["watchList"]

    def _call(self, view, method, viewer, **kwargs):
        request = getattr(self.factory, method)("/api/anything/")
        force_authenticate(request, user=viewer)
        return view(request, **kwargs)

    # --- lookup --------------------------------------------------------------

    def test_profile_creates_a_flagged_watchlist(self):
        data = self._profile_watchlist(self.me)
        row = Collection.objects.get(public_id=data["public_id"])
        self.assertTrue(row.is_watchlist)
        self.assertEqual(row.owner, self.me)
        self.assertTrue(data["is_watchlist"])

    def test_repeated_and_cross_viewer_calls_never_create_a_second_watchlist(self):
        first = self._profile_watchlist(self.me)
        self._profile_watchlist(self.me)
        second = self._profile_watchlist(self.me, viewer=self.friend)
        self.assertEqual(first["public_id"], second["public_id"])
        self.assertEqual(Collection.objects.filter(owner=self.me, is_watchlist=True).count(), 1)
        self.assertEqual(Collection.objects.filter(owner=self.me).count(), 1)

    def test_finds_a_legacy_row_flagged_by_the_migration_instead_of_creating_another(self):
        legacy = Collection.objects.create(name="user_2meClerkId's Watchlist", owner=self.me, is_watchlist=True)
        data = self._profile_watchlist(self.me)
        self.assertEqual(data["public_id"], str(legacy.public_id))
        self.assertEqual(Collection.objects.filter(owner=self.me).count(), 1)

    # --- adopting a legacy row (no dependence on migration timing) -------------

    def test_adopts_an_unflagged_legacy_row_with_its_essays_instead_of_creating_a_new_one(self):
        essay = VideoEssay.objects.create(title="E", owner=self.me)
        legacy = Collection.objects.create(name="user_2meClerkId's Watchlist", owner=self.me)
        legacy.essays.add(essay)
        data = self._profile_watchlist(self.me)
        self.assertEqual(data["public_id"], str(legacy.public_id))
        self.assertEqual(len(data["essays"]), 1)
        legacy.refresh_from_db()
        self.assertTrue(legacy.is_watchlist)
        self.assertEqual(Collection.objects.filter(owner=self.me).count(), 1)

    def test_adopts_the_lowest_id_when_there_are_several_legacy_rows(self):
        first = Collection.objects.create(name="user_2meClerkId's Watchlist", owner=self.me)
        second = Collection.objects.create(name="user_2meClerkId's Watchlist", owner=self.me)
        data = self._profile_watchlist(self.me)
        self.assertEqual(data["public_id"], str(first.public_id))
        second.refresh_from_db()
        self.assertFalse(second.is_watchlist)

    def test_does_not_adopt_lists_that_only_look_similar(self):
        Collection.objects.create(name="My Watchlist favorites", owner=self.me)
        Collection.objects.create(name="Watchlist", owner=self.me)  # right idea, but not the legacy name
        Collection.objects.create(name="user_2meClerkId's Watchlist", owner=self.friend)  # someone else's
        data = self._profile_watchlist(self.me)
        created = Collection.objects.get(public_id=data["public_id"])
        self.assertTrue(created.is_watchlist)
        self.assertEqual(created.owner, self.me)
        self.assertEqual(Collection.objects.filter(owner=self.me).count(), 3)
        self.assertEqual(Collection.objects.filter(owner=self.me, is_watchlist=True).count(), 1)
        self.assertFalse(Collection.objects.get(owner=self.friend).is_watchlist)

    def test_an_existing_flagged_watchlist_wins_over_a_legacy_row(self):
        flagged = Collection.objects.create(name="Watchlist", owner=self.me, is_watchlist=True)
        legacy = Collection.objects.create(name="user_2meClerkId's Watchlist", owner=self.me)
        data = self._profile_watchlist(self.me)
        self.assertEqual(data["public_id"], str(flagged.public_id))
        legacy.refresh_from_db()
        self.assertFalse(legacy.is_watchlist)

    def test_adoption_is_idempotent(self):
        Collection.objects.create(name="user_2meClerkId's Watchlist", owner=self.me)
        first = self._profile_watchlist(self.me)
        second = self._profile_watchlist(self.me)
        self.assertEqual(first["public_id"], second["public_id"])
        self.assertEqual(Collection.objects.filter(owner=self.me).count(), 1)

    # --- title ----------------------------------------------------------------

    def test_title_is_derived_from_the_display_username(self):
        data = self._profile_watchlist(self.me)
        self.assertEqual(data["name"], "hillary's Watchlist")

    def test_title_uses_the_display_username_even_for_legacy_stored_names(self):
        Collection.objects.create(name="user_2meClerkId's Watchlist", owner=self.me, is_watchlist=True)
        self.assertEqual(self._profile_watchlist(self.me)["name"], "hillary's Watchlist")

    def test_title_is_plain_watchlist_when_the_owner_has_no_display_username(self):
        self.assertEqual(self._profile_watchlist(self.anon)["name"], "Watchlist")

    def test_the_clerk_id_never_appears_in_a_watchlist_payload(self):
        Collection.objects.create(name="user_2meClerkId's Watchlist", owner=self.me, is_watchlist=True)
        self.assertNotIn("user_2", str(self._profile_watchlist(self.me)))

    def test_collection_detail_uses_the_derived_title_and_flag_and_the_list_omits_it(self):
        # Watchlists are private (test_collection_privacy.py): the owner reads theirs through
        # detail; the public list never contains one.
        watchlist = Collection.objects.create(name="user_2meClerkId's Watchlist", owner=self.me, is_watchlist=True)
        detail = self._call(CollectionDetail.as_view(), "get", self.me, public_id=watchlist.public_id)
        self.assertEqual((detail.data["name"], detail.data["is_watchlist"]), ("hillary's Watchlist", True))
        rows = self._call(CollectionList.as_view(), "get", self.friend).data["results"]
        self.assertEqual(rows, [])

    def test_ordinary_lists_keep_their_own_name(self):
        Collection.objects.create(name="My Watchlist favorites", owner=self.me)
        rows = self._call(CollectionList.as_view(), "get", self.me).data["results"]
        self.assertEqual([r["name"] for r in rows], ["My Watchlist favorites"])

    # --- delete protection ----------------------------------------------------

    def test_the_watchlist_cannot_be_deleted(self):
        watchlist = Collection.objects.create(name="Watchlist", owner=self.me, is_watchlist=True)
        response = self._call(RemoveCollection.as_view(), "delete", self.me, collection_public_id=watchlist.public_id)
        self.assertEqual(response.status_code, 403)
        self.assertTrue(Collection.objects.filter(pk=watchlist.pk).exists())

    def test_a_list_with_watchlist_in_its_name_can_be_deleted(self):
        ordinary = Collection.objects.create(name="My Watchlist favorites", owner=self.me)
        response = self._call(RemoveCollection.as_view(), "delete", self.me, collection_public_id=ordinary.public_id)
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Collection.objects.filter(pk=ordinary.pk).exists())

    def test_a_list_named_like_the_old_watchlist_pattern_can_be_deleted_if_not_flagged(self):
        ordinary = Collection.objects.create(name="user_2meClerkId's Watchlist", owner=self.me)
        response = self._call(RemoveCollection.as_view(), "delete", self.me, collection_public_id=ordinary.public_id)
        self.assertEqual(response.status_code, 200)

    def test_other_users_lists_are_still_not_found(self):
        theirs = Collection.objects.create(name="Theirs", owner=self.friend)
        response = self._call(RemoveCollection.as_view(), "delete", self.me, collection_public_id=theirs.public_id)
        self.assertEqual(response.status_code, 404)
        self.assertTrue(Collection.objects.filter(pk=theirs.pk).exists())
