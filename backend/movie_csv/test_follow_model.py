"""Tests for users.models.Follow and the migrations around it: 0010 seeds it from the
old Profile.followers / Profile.following M2Ms, 0011 drops those M2Ms (and restores them
from Follow if it is ever reversed).

The DB must be the thing that rejects duplicate and self follows, so these tests
go straight to the model rather than through the toggle view.
"""
from importlib import import_module

from django.contrib.auth import get_user_model
from django.db import IntegrityError, connection, transaction
from django.db.migrations.executor import MigrationExecutor
from django.test import TestCase, TransactionTestCase

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


class LegacyFollowFieldsTests(TestCase):
    def test_profile_no_longer_has_the_legacy_m2ms(self):
        field_names = {f.name for f in Profile._meta.get_fields()}

        self.assertNotIn("followers", field_names)
        self.assertNotIn("following", field_names)


class FollowMigrationTests(TransactionTestCase):
    """Runs the real migrations against the historical schema.

    Schema changes cannot live inside TestCase's transaction, and the legacy M2Ms only
    exist in the historical state, so each test migrates users back, works with the
    historical models, and always migrates forward again in tearDown.
    """

    copy_target = ("users", "0009_create_follow")
    pre_drop_target = ("users", "0010_copy_follows")

    def setUp(self):
        self.alice = User.objects.create(username="alice")
        self.bob = User.objects.create(username="bob")
        self.carol = User.objects.create(username="carol")
        for user in (self.alice, self.bob, self.carol):
            Profile.objects.get_or_create(user=user)

    def tearDown(self):
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())

    def _migrate_to(self, target):
        executor = MigrationExecutor(connection)
        executor.migrate([target])
        return executor.loader.project_state([target]).apps

    def _legacy_follow(self, old_apps, follower, followee):
        """Write both sides, exactly as the old FollowUser view did."""
        Profile = old_apps.get_model("users", "Profile")
        Profile.objects.get(user_id=follower.id).following.add(followee.id)
        Profile.objects.get(user_id=followee.id).followers.add(follower.id)

    def _copy(self, old_apps):
        copy_migration.copy_follows(old_apps, None)
        Follow = old_apps.get_model("users", "Follow")
        return set(Follow.objects.values_list("follower_id", "followee_id"))

    def test_copies_each_legacy_follow_once(self):
        old_apps = self._migrate_to(self.copy_target)
        self._legacy_follow(old_apps, self.alice, self.bob)
        self._legacy_follow(old_apps, self.carol, self.bob)

        pairs = self._copy(old_apps)

        self.assertEqual(pairs, {(self.alice.id, self.bob.id), (self.carol.id, self.bob.id)})

    def test_running_twice_does_not_duplicate(self):
        old_apps = self._migrate_to(self.copy_target)
        self._legacy_follow(old_apps, self.alice, self.bob)

        self._copy(old_apps)
        pairs = self._copy(old_apps)

        self.assertEqual(pairs, {(self.alice.id, self.bob.id)})

    def test_skips_legacy_self_follows(self):
        old_apps = self._migrate_to(self.copy_target)
        Profile_ = old_apps.get_model("users", "Profile")
        Profile_.objects.get(user_id=self.alice.id).following.add(self.alice.id)

        self.assertEqual(self._copy(old_apps), set())

    def test_one_sided_followers_row_is_reported_not_copied(self):
        # Drift: bob's Profile.followers lists alice, but alice's Profile.following does not list bob.
        old_apps = self._migrate_to(self.copy_target)
        old_apps.get_model("users", "Profile").objects.get(user_id=self.bob.id).followers.add(self.alice.id)

        with self.assertLogs("users.migrations.0010_copy_follows", level="WARNING") as logs:
            pairs = self._copy(old_apps)

        self.assertEqual(pairs, set())
        self.assertIn("alice", logs.output[0])
        self.assertIn("bob", logs.output[0])

    def test_reversing_the_drop_restores_both_m2m_sides_from_follow_rows(self):
        Follow.objects.create(follower=self.alice, followee=self.bob)
        Follow.objects.create(follower=self.carol, followee=self.bob)

        old_apps = self._migrate_to(self.pre_drop_target)

        OldProfile = old_apps.get_model("users", "Profile")
        alice = OldProfile.objects.get(user_id=self.alice.id)
        bob = OldProfile.objects.get(user_id=self.bob.id)
        self.assertEqual(set(alice.following.values_list("id", flat=True)), {self.bob.id})
        self.assertEqual(set(bob.followers.values_list("id", flat=True)), {self.alice.id, self.carol.id})
        self.assertEqual(set(bob.following.values_list("id", flat=True)), set())
