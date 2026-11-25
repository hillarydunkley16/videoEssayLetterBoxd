"""Tests for blocking: POST/DELETE /api/users/<id>/block/, GET /api/users/blocked/, and the
follow and comment rules across a block.

ClerkAuthentication is bypassed with DRF's force_authenticate.
"""
from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIRequestFactory, force_authenticate

from movie_csv.models import Comment, Log, VideoEssay
from movie_csv.views.api import BlockedUsersList, BlockUser, CommentOnPost, FollowUser
from users.models import Block, Follow

User = get_user_model()


class BlockTestCase(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.me = User.objects.create(username="me")
        self.other = User.objects.create(username="other")
        self.third = User.objects.create(username="third")
        for user, name in ((self.me, "me_name"), (self.other, "other_name"), (self.third, "third_name")):
            user.profile.display_username = name
            user.profile.save()

    def _call(self, view, method, path, user, *args, **kwargs):
        request = getattr(self.factory, method)(path, **kwargs.pop("request_kwargs", {}))
        if user is not None:
            force_authenticate(request, user=user)
        return view.as_view()(request, *args, **kwargs)

    def block(self, target_id, user="me"):
        user = self.me if user == "me" else user
        return self._call(BlockUser, "post", f"/api/users/{target_id}/block/", user, user_id=target_id)

    def unblock(self, target_id, user="me"):
        user = self.me if user == "me" else user
        return self._call(BlockUser, "delete", f"/api/users/{target_id}/block/", user, user_id=target_id)


class BlockUserTests(BlockTestCase):
    def test_blocks_the_user(self):
        response = self.block(self.other.id)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(Block.objects.filter(blocker=self.me, blocked=self.other).exists())

    def test_blocking_twice_is_idempotent(self):
        self.block(self.other.id)
        response = self.block(self.other.id)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(Block.objects.filter(blocker=self.me, blocked=self.other).count(), 1)

    def test_cannot_block_yourself(self):
        response = self.block(self.me.id)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Block.objects.count(), 0)

    def test_unknown_user_is_404(self):
        self.assertEqual(self.block(999999).status_code, 404)

    def test_unauthenticated_is_rejected(self):
        response = self._call(BlockUser, "post", "/api/users/1/block/", None, user_id=self.other.id)
        self.assertIn(response.status_code, (401, 403))
        self.assertEqual(Block.objects.count(), 0)

    def test_removes_follows_in_both_directions(self):
        Follow.objects.create(follower=self.me, followee=self.other)
        Follow.objects.create(follower=self.other, followee=self.me)
        Follow.objects.create(follower=self.third, followee=self.other)

        self.block(self.other.id)

        self.assertFalse(Follow.objects.filter(follower=self.me, followee=self.other).exists())
        self.assertFalse(Follow.objects.filter(follower=self.other, followee=self.me).exists())
        # Follows that don't involve the blocker are untouched.
        self.assertTrue(Follow.objects.filter(follower=self.third, followee=self.other).exists())

    def test_follower_counts_update(self):
        Follow.objects.create(follower=self.me, followee=self.other)
        self.assertEqual(Follow.objects.filter(followee=self.other).count(), 1)
        self.block(self.other.id)
        self.assertEqual(Follow.objects.filter(followee=self.other).count(), 0)


class UnblockUserTests(BlockTestCase):
    def test_unblocks_the_user(self):
        Block.objects.create(blocker=self.me, blocked=self.other)
        response = self.unblock(self.other.id)
        self.assertEqual(response.status_code, 204)
        self.assertEqual(Block.objects.count(), 0)

    def test_unblock_does_not_restore_follows(self):
        Follow.objects.create(follower=self.me, followee=self.other)
        self.block(self.other.id)
        self.unblock(self.other.id)
        self.assertEqual(Follow.objects.count(), 0)

    def test_unblocking_someone_not_blocked_is_idempotent(self):
        self.assertEqual(self.unblock(self.other.id).status_code, 204)

    def test_only_removes_the_callers_own_block(self):
        # `other` blocked `me`; `me` unblocking `other` must not remove that row.
        Block.objects.create(blocker=self.other, blocked=self.me)
        self.unblock(self.other.id)
        self.assertTrue(Block.objects.filter(blocker=self.other, blocked=self.me).exists())

    def test_unknown_user_is_404(self):
        self.assertEqual(self.unblock(999999).status_code, 404)

    def test_unauthenticated_is_rejected(self):
        response = self._call(BlockUser, "delete", "/api/users/1/block/", None, user_id=self.other.id)
        self.assertIn(response.status_code, (401, 403))


class BlockedUsersListTests(BlockTestCase):
    def _list(self, user="me"):
        user = self.me if user == "me" else user
        return self._call(BlockedUsersList, "get", "/api/users/blocked/", user)

    def test_lists_only_the_callers_blocks_with_profile_fields(self):
        Block.objects.create(blocker=self.me, blocked=self.other)
        Block.objects.create(blocker=self.third, blocked=self.me)

        response = self._list()

        self.assertEqual(response.status_code, 200)
        results = response.data["results"]
        self.assertEqual([r["id"] for r in results], [self.other.id])
        self.assertEqual(results[0]["username"], "other_name")
        self.assertIn("imageUrl", results[0])

    def test_empty_when_nobody_is_blocked(self):
        self.assertEqual(self._list().data["results"], [])

    def test_newest_block_first(self):
        Block.objects.create(blocker=self.me, blocked=self.other)
        Block.objects.create(blocker=self.me, blocked=self.third)
        ids = [r["id"] for r in self._list().data["results"]]
        self.assertEqual(ids, [self.third.id, self.other.id])

    def test_query_count_does_not_grow_with_rows(self):
        Block.objects.create(blocker=self.me, blocked=self.other)
        with CaptureQueriesContext(connection) as one:
            self._list()
        for i in range(5):
            extra = User.objects.create(username=f"extra{i}")
            Block.objects.create(blocker=self.me, blocked=extra)
        with CaptureQueriesContext(connection) as many:
            self._list()
        self.assertEqual(len(one), len(many))

    def test_unauthenticated_is_rejected(self):
        response = self._call(BlockedUsersList, "get", "/api/users/blocked/", None)
        self.assertIn(response.status_code, (401, 403))


class FollowAcrossBlockTests(BlockTestCase):
    def _follow(self, follower, target):
        return self._call(FollowUser, "post", f"/api/users/{target.id}/follow/", follower, user_id=target.id)

    def test_blocker_cannot_follow_the_blocked_user(self):
        Block.objects.create(blocker=self.me, blocked=self.other)
        self.assertEqual(self._follow(self.me, self.other).status_code, 403)
        self.assertEqual(Follow.objects.count(), 0)

    def test_blocked_user_cannot_follow_the_blocker(self):
        Block.objects.create(blocker=self.me, blocked=self.other)
        self.assertEqual(self._follow(self.other, self.me).status_code, 403)
        self.assertEqual(Follow.objects.count(), 0)

    def test_refusal_does_not_say_the_caller_was_blocked(self):
        Block.objects.create(blocker=self.me, blocked=self.other)
        message = str(self._follow(self.other, self.me).data).lower()
        self.assertNotIn("block", message)

    def test_unrelated_follow_still_works(self):
        Block.objects.create(blocker=self.me, blocked=self.other)
        response = self._follow(self.third, self.me)
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["following"])


class CommentAcrossBlockTests(BlockTestCase):
    def setUp(self):
        super().setUp()
        essay = VideoEssay.objects.create(title="E", owner=self.third)
        self.log = Log.objects.create(
            owner=self.me, essay=essay, date="2026-09-20", rating=3, review_text="x"
        )

    def _comment(self, commenter, text="hi"):
        request = self.factory.post(
            f"/api/logList/{self.log.public_id}/comment/", {"text": text}, format="json"
        )
        force_authenticate(request, user=commenter)
        return CommentOnPost.as_view()(request, public_id=self.log.public_id)

    def test_blocked_user_cannot_comment_on_the_blockers_log(self):
        Block.objects.create(blocker=self.me, blocked=self.other)
        self.assertEqual(self._comment(self.other).status_code, 403)
        self.assertEqual(Comment.objects.count(), 0)

    def test_blocker_cannot_comment_on_the_blocked_users_log(self):
        Block.objects.create(blocker=self.other, blocked=self.me)
        other_log = Log.objects.create(
            owner=self.other, essay=self.log.essay, date="2026-09-20", rating=3, review_text="y"
        )
        request = self.factory.post(
            f"/api/logList/{other_log.public_id}/comment/", {"text": "hi"}, format="json"
        )
        force_authenticate(request, user=self.me)
        response = CommentOnPost.as_view()(request, public_id=other_log.public_id)
        self.assertEqual(response.status_code, 403)

    def test_refusal_does_not_say_the_caller_was_blocked(self):
        Block.objects.create(blocker=self.me, blocked=self.other)
        self.assertNotIn("block", str(self._comment(self.other).data).lower())

    def test_unrelated_user_can_still_comment(self):
        Block.objects.create(blocker=self.me, blocked=self.other)
        self.assertEqual(self._comment(self.third).status_code, 201)
