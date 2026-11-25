"""Tests for users.Block and its viewer helpers (blocked_user_ids, exclude_blocked)."""
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AnonymousUser
from django.db import IntegrityError, transaction
from django.test import TestCase

from users.models import Block, blocked_user_ids, exclude_blocked

User = get_user_model()


class BlockModelTests(TestCase):
    def setUp(self):
        self.a = User.objects.create(username="a")
        self.b = User.objects.create(username="b")
        self.c = User.objects.create(username="c")

    def test_duplicate_block_is_rejected(self):
        Block.objects.create(blocker=self.a, blocked=self.b)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Block.objects.create(blocker=self.a, blocked=self.b)

    def test_opposite_direction_is_a_separate_row(self):
        Block.objects.create(blocker=self.a, blocked=self.b)
        Block.objects.create(blocker=self.b, blocked=self.a)
        self.assertEqual(Block.objects.count(), 2)

    def test_self_block_is_rejected(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            Block.objects.create(blocker=self.a, blocked=self.a)

    def test_deleting_the_blocker_removes_the_row(self):
        Block.objects.create(blocker=self.a, blocked=self.b)
        self.a.delete()
        self.assertEqual(Block.objects.count(), 0)

    def test_deleting_the_blocked_user_removes_the_row(self):
        Block.objects.create(blocker=self.a, blocked=self.b)
        self.b.delete()
        self.assertEqual(Block.objects.count(), 0)


class BlockedUserIdsTests(TestCase):
    def setUp(self):
        self.a = User.objects.create(username="a")
        self.b = User.objects.create(username="b")
        self.c = User.objects.create(username="c")

    def test_blocker_sees_the_blocked_user(self):
        Block.objects.create(blocker=self.a, blocked=self.b)
        self.assertEqual(blocked_user_ids(self.a), {self.b.id})

    def test_blocked_user_sees_the_blocker(self):
        Block.objects.create(blocker=self.a, blocked=self.b)
        self.assertEqual(blocked_user_ids(self.b), {self.a.id})

    def test_unrelated_user_sees_nothing(self):
        Block.objects.create(blocker=self.a, blocked=self.b)
        self.assertEqual(blocked_user_ids(self.c), set())

    def test_both_directions_combine_without_duplicates(self):
        Block.objects.create(blocker=self.a, blocked=self.b)
        Block.objects.create(blocker=self.c, blocked=self.a)
        self.assertEqual(blocked_user_ids(self.a), {self.b.id, self.c.id})

    def test_anonymous_viewer_is_empty_and_runs_no_query(self):
        Block.objects.create(blocker=self.a, blocked=self.b)
        with self.assertNumQueries(0):
            self.assertEqual(blocked_user_ids(AnonymousUser()), set())
            self.assertEqual(blocked_user_ids(None), set())

    def test_runs_one_query(self):
        Block.objects.create(blocker=self.a, blocked=self.b)
        with self.assertNumQueries(1):
            blocked_user_ids(self.a)


class ExcludeBlockedTests(TestCase):
    def setUp(self):
        self.a = User.objects.create(username="a")
        self.b = User.objects.create(username="b")
        self.c = User.objects.create(username="c")
        Block.objects.create(blocker=self.a, blocked=self.b)

    def _ids(self, viewer, field="id"):
        return set(exclude_blocked(User.objects.all(), viewer, field).values_list("id", flat=True))

    def test_hides_blocked_user_from_the_blocker(self):
        self.assertNotIn(self.b.id, self._ids(self.a))
        self.assertIn(self.c.id, self._ids(self.a))

    def test_hides_the_blocker_from_the_blocked_user(self):
        self.assertNotIn(self.a.id, self._ids(self.b))
        self.assertIn(self.c.id, self._ids(self.b))

    def test_unrelated_viewer_sees_everyone(self):
        self.assertEqual(self._ids(self.c), {self.a.id, self.b.id, self.c.id})

    def test_anonymous_viewer_sees_everyone(self):
        self.assertEqual(self._ids(AnonymousUser()), {self.a.id, self.b.id, self.c.id})

    def test_filters_through_a_foreign_key_field(self):
        from movie_csv.models import Log, VideoEssay
        essay = VideoEssay.objects.create(title="E", owner=self.c)
        for owner in (self.a, self.b, self.c):
            Log.objects.create(owner=owner, essay=essay, date="2026-09-20", rating=3, review_text="x")
        visible = exclude_blocked(Log.objects.all(), self.a, "owner")
        self.assertEqual({log.owner_id for log in visible}, {self.a.id, self.c.id})

    def test_is_a_single_query(self):
        with self.assertNumQueries(1):
            list(exclude_blocked(User.objects.all(), self.a, "id"))
