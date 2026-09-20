"""Tests for users.models.Follow and the migration that seeds it from the old
Profile.followers / Profile.following M2Ms.

The DB must be the thing that rejects duplicate and self follows, so these tests
go straight to the model rather than through the toggle view.
"""
from importlib import import_module

from django.apps import apps
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import TestCase

from users.models import Follow, Profile

User = get_user_model()

copy_migration = import_module("users.migrations.0010_copy_follows")


class FollowConstraintTests(TestCase):
    def setUp(self):
        self.alice = User.objects.create(username="alice")
        self.bob = User.objects.create(username="bob")

    def test_creates_a_follow(self):
        Follow.objects.create(follower=self.alice, followee=self.bob)

        self.assertTrue(Follow.objects.filter(follower=self.alice, followee=self.bob).exists())

    def test_duplicate_follow_is_rejected(self):
        Follow.objects.create(follower=self.alice, followee=self.bob)

        with self.assertRaises(IntegrityError), transaction.atomic():
            Follow.objects.create(follower=self.alice, followee=self.bob)

    def test_self_follow_is_rejected(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            Follow.objects.create(follower=self.alice, followee=self.alice)

    def test_follow_is_directional(self):
        Follow.objects.create(follower=self.alice, followee=self.bob)

        Follow.objects.create(follower=self.bob, followee=self.alice)

        self.assertEqual(Follow.objects.count(), 2)

    def test_related_names_expose_both_sides(self):
        Follow.objects.create(follower=self.alice, followee=self.bob)

        self.assertEqual(self.alice.following_set.get().followee, self.bob)
        self.assertEqual(self.bob.follower_set.get().follower, self.alice)

    def test_deleting_a_user_deletes_their_follows(self):
        Follow.objects.create(follower=self.alice, followee=self.bob)

        self.bob.delete()

        self.assertEqual(Follow.objects.count(), 0)


class CopyFollowsMigrationTests(TestCase):
    """0010_copy_follows seeds Follow from the legacy Profile.following M2M."""

    def setUp(self):
        self.alice = User.objects.create(username="alice")
        self.bob = User.objects.create(username="bob")
        self.carol = User.objects.create(username="carol")
        self.profiles = {u.id: Profile.objects.get_or_create(user=u)[0] for u in (self.alice, self.bob, self.carol)}

    def _legacy_follow(self, follower, followee):
        """Write both sides, exactly as the old FollowUser view did."""
        self.profiles[follower.id].following.add(followee)
        self.profiles[followee.id].followers.add(follower)

    def _run(self):
        copy_migration.copy_follows(apps, None)

    def test_copies_each_legacy_follow_once(self):
        self._legacy_follow(self.alice, self.bob)
        self._legacy_follow(self.carol, self.bob)

        self._run()

        pairs = set(Follow.objects.values_list("follower_id", "followee_id"))
        self.assertEqual(pairs, {(self.alice.id, self.bob.id), (self.carol.id, self.bob.id)})

    def test_running_twice_does_not_duplicate(self):
        self._legacy_follow(self.alice, self.bob)

        self._run()
        self._run()

        self.assertEqual(Follow.objects.count(), 1)

    def test_skips_legacy_self_follows(self):
        self.profiles[self.alice.id].following.add(self.alice)

        self._run()

        self.assertEqual(Follow.objects.count(), 0)

    def test_one_sided_followers_row_is_reported_not_copied(self):
        # Drift: bob's Profile.followers lists alice, but alice's Profile.following does not list bob.
        self.profiles[self.bob.id].followers.add(self.alice)

        with self.assertLogs("users.migrations.0010_copy_follows", level="WARNING") as logs:
            self._run()

        self.assertEqual(Follow.objects.count(), 0)
        self.assertIn("alice", logs.output[0])
        self.assertIn("bob", logs.output[0])
