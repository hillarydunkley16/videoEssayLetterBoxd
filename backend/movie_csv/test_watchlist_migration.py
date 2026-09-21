"""Migrations 0011/0012: flag each owner's watchlist and allow at most one per owner.

The watchlist used to be identified only by its name, "<username>'s Watchlist" (username being
the Clerk id). 0011 sets `is_watchlist` on those rows; 0012 adds a partial unique constraint.
Nothing is renamed or deleted, and duplicates are left unflagged for a human to look at.
"""
from importlib import import_module

from django.apps import apps as django_apps
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import TestCase

from movie_csv.models import Collection

User = get_user_model()
migration = import_module("movie_csv.migrations.0011_flag_watchlists")


def _watchlist_name(user):
    return f"{user.username}'s Watchlist"


class FlagWatchlistsTests(TestCase):
    def setUp(self):
        self.a = User.objects.create(username="user_a")
        self.b = User.objects.create(username="user_b")

    def _flagged(self):
        return set(Collection.objects.filter(is_watchlist=True).values_list("name", "owner__username"))

    def _forwards(self):
        migration.flag_watchlists(django_apps, None)

    def test_flags_each_owners_watchlist_row(self):
        Collection.objects.create(name=_watchlist_name(self.a), owner=self.a)
        Collection.objects.create(name=_watchlist_name(self.b), owner=self.b)
        self._forwards()
        self.assertEqual(
            self._flagged(),
            {("user_a's Watchlist", "user_a"), ("user_b's Watchlist", "user_b")},
        )

    def test_does_not_rename_or_delete_anything(self):
        Collection.objects.create(name=_watchlist_name(self.a), owner=self.a)
        Collection.objects.create(name="Favorites", owner=self.a)
        before = sorted(Collection.objects.values_list("id", "name", "owner_id"))
        self._forwards()
        self.assertEqual(sorted(Collection.objects.values_list("id", "name", "owner_id")), before)

    def test_leaves_user_lists_alone_even_if_the_name_mentions_watchlist(self):
        Collection.objects.create(name="My Watchlist favorites", owner=self.a)
        Collection.objects.create(name="Watchlist", owner=self.a)
        # right suffix, wrong owner: another user's list that happens to be named like a's watchlist
        Collection.objects.create(name=_watchlist_name(self.a), owner=self.b)
        self._forwards()
        self.assertEqual(self._flagged(), set())

    def test_flags_only_the_lowest_id_when_an_owner_has_duplicates(self):
        first = Collection.objects.create(name=_watchlist_name(self.a), owner=self.a)
        second = Collection.objects.create(name=_watchlist_name(self.a), owner=self.a)
        self._forwards()
        first.refresh_from_db()
        second.refresh_from_db()
        self.assertTrue(first.is_watchlist)
        self.assertFalse(second.is_watchlist)

    def test_skips_an_owner_who_already_has_a_flagged_watchlist(self):
        existing = Collection.objects.create(name="Watchlist", owner=self.a, is_watchlist=True)
        legacy = Collection.objects.create(name=_watchlist_name(self.a), owner=self.a)
        self._forwards()
        legacy.refresh_from_db()
        self.assertFalse(legacy.is_watchlist)
        self.assertEqual(Collection.objects.filter(owner=self.a, is_watchlist=True).count(), 1)
        self.assertTrue(Collection.objects.get(pk=existing.pk).is_watchlist)

    def test_is_idempotent(self):
        Collection.objects.create(name=_watchlist_name(self.a), owner=self.a)
        self._forwards()
        once = self._flagged()
        self._forwards()
        self.assertEqual(self._flagged(), once)

    def test_reverse_unflags_the_rows_it_flagged(self):
        Collection.objects.create(name=_watchlist_name(self.a), owner=self.a)
        self._forwards()
        migration.unflag_watchlists(django_apps, None)
        self.assertEqual(self._flagged(), set())
        self.assertEqual(Collection.objects.count(), 1)


class OneWatchlistPerOwnerConstraintTests(TestCase):
    def setUp(self):
        self.a = User.objects.create(username="user_a")
        self.b = User.objects.create(username="user_b")

    def test_second_watchlist_for_the_same_owner_is_rejected(self):
        Collection.objects.create(name="Watchlist", owner=self.a, is_watchlist=True)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Collection.objects.create(name="Another", owner=self.a, is_watchlist=True)

    def test_different_owners_can_each_have_one(self):
        Collection.objects.create(name="Watchlist", owner=self.a, is_watchlist=True)
        Collection.objects.create(name="Watchlist", owner=self.b, is_watchlist=True)
        self.assertEqual(Collection.objects.filter(is_watchlist=True).count(), 2)

    def test_owners_can_have_many_ordinary_lists_alongside_a_watchlist(self):
        Collection.objects.create(name="Watchlist", owner=self.a, is_watchlist=True)
        Collection.objects.create(name="One", owner=self.a)
        Collection.objects.create(name="Two", owner=self.a)
        self.assertEqual(Collection.objects.filter(owner=self.a).count(), 3)
