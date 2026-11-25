"""A block hides each user's content from the other, on every surface that shows other users.

Cast: `viewer` blocked `blocked`; `blocker` blocked `viewer`; `plain` has no block with anyone.
So for `viewer`, both `blocked` and `blocker` must disappear, and for `blocked` or `blocker`,
`viewer` must disappear. ClerkAuthentication is bypassed with force_authenticate.
"""
from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIRequestFactory, force_authenticate

from movie_csv.models import Collection, Comment, Like, Log, VideoEssay
from movie_csv.views.api import (
    CollectionDetail,
    CollectionList,
    CollectionSearch,
    FollowersList,
    FollowingFeed,
    FollowingList,
    LikePost,
    logDetail,
    logList,
    ProfileDetailById,
    SuggestedUsers,
    UserList,
    userLogs,
    UserSearch,
    VideoInfo,
)
from users.models import Block, Follow

User = get_user_model()
DAY = "2026-09-20"


class BlockFilteringCase(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.viewer = self._user("viewer")
        self.blocked = self._user("blockedguy")
        self.blocker = self._user("blockerguy")
        self.plain = self._user("plainguy")
        Block.objects.create(blocker=self.viewer, blocked=self.blocked)
        Block.objects.create(blocker=self.blocker, blocked=self.viewer)
        self.essay = VideoEssay.objects.create(title="An Essay", owner=self.plain)

    def _user(self, name):
        user = User.objects.create(username=name)
        user.profile.display_username = name
        user.profile.save()
        return user

    def _log(self, owner, text="review"):
        return Log.objects.create(owner=owner, essay=self.essay, date=DAY, rating=4, review_text=text)

    def _list(self, owner, name="A List"):
        collection = Collection.objects.create(owner=owner, name=name)
        collection.essays.add(self.essay)
        return collection

    def _call(self, view, user, path="/x/", query="", **kwargs):
        request = self.factory.get(f"{path}{query}")
        if user is not None:
            force_authenticate(request, user=user)
        return view.as_view()(request, **kwargs)


class LogSurfaceTests(BlockFilteringCase):
    def setUp(self):
        super().setUp()
        self.logs = {u.username: self._log(u, f"by {u.username}") for u in
                     (self.viewer, self.blocked, self.blocker, self.plain)}

    def _owners(self, response):
        return {row["owner"] for row in response.data["results"]}

    def test_log_list_hides_blocked_users_both_ways(self):
        self.assertEqual(self._owners(self._call(logList, self.viewer)), {"viewer", "plainguy"})
        self.assertEqual(self._owners(self._call(logList, self.blocked)), {"blockedguy", "plainguy", "blockerguy"})
        self.assertEqual(self._owners(self._call(logList, self.blocker)), {"blockerguy", "plainguy", "blockedguy"})

    def test_log_detail_of_a_blocked_user_is_404_both_ways(self):
        for owner in (self.blocked, self.blocker):
            response = self._call(logDetail, self.viewer, public_id=self.logs[owner.username].public_id)
            self.assertEqual(response.status_code, 404, owner.username)
        response = self._call(logDetail, self.blocked, public_id=self.logs["viewer"].public_id)
        self.assertEqual(response.status_code, 404)

    def test_log_detail_still_works_for_own_and_unrelated_logs(self):
        for owner in (self.viewer, self.plain):
            response = self._call(logDetail, self.viewer, public_id=self.logs[owner.username].public_id)
            self.assertEqual(response.status_code, 200, owner.username)

    def test_video_info_hides_blocked_logs_and_recounts(self):
        response = self._call(VideoInfo, self.viewer, public_id=self.essay.public_id)
        self.assertEqual({row["owner"] for row in response.data["logs"]}, {"viewer", "plainguy"})
        self.assertEqual(response.data["log_count"], 2)

    def test_video_info_is_unfiltered_for_anonymous(self):
        response = self._call(VideoInfo, None, public_id=self.essay.public_id)
        self.assertEqual(response.data["log_count"], 4)

    def test_following_feed_hides_blocked_users_even_with_a_stale_follow(self):
        Follow.objects.create(follower=self.viewer, followee=self.blocked)
        Follow.objects.create(follower=self.viewer, followee=self.plain)
        response = self._call(FollowingFeed, self.viewer)
        self.assertEqual(self._owners(response), {"plainguy"})

    def test_log_list_query_count_does_not_grow_with_rows(self):
        with CaptureQueriesContext(connection) as small:
            self._call(logList, self.viewer)
        for i in range(6):
            extra = self._user(f"extra{i}")
            log = self._log(extra)
            Comment.objects.create(user=extra, log=log, text="c")
            Like.objects.create(user=extra, post=log)
        with CaptureQueriesContext(connection) as large:
            self._call(logList, self.viewer)
        self.assertEqual(len(small), len(large))


class CommentAndLikeTests(BlockFilteringCase):
    def setUp(self):
        super().setUp()
        self.log = self._log(self.plain)
        for user in (self.viewer, self.blocked, self.blocker, self.plain):
            Comment.objects.create(user=user, log=self.log, text=f"from {user.username}")
            Like.objects.create(user=user, post=self.log)

    def _detail(self, viewer):
        return self._call(logDetail, viewer, public_id=self.log.public_id).data["log"]

    def test_comments_hide_blocked_authors_both_ways(self):
        authors = {c["user"] for c in self._detail(self.viewer)["comments"]}
        self.assertEqual(authors, {"viewer", "plainguy"})
        authors = {c["user"] for c in self._detail(self.blocked)["comments"]}
        self.assertEqual(authors, {"blockedguy", "plainguy", "blockerguy"})

    def test_likes_hide_blocked_users_so_the_count_matches(self):
        likes = self._detail(self.viewer)["likes"]
        self.assertEqual({like["user"] for like in likes}, {self.viewer.id, self.plain.id})
        self.assertEqual(len(likes), 2)

    def test_is_liked_is_unaffected(self):
        self.assertTrue(self._detail(self.viewer)["is_liked"])

    def test_like_toggle_count_excludes_blocked_users(self):
        request = self.factory.post(f"/api/logList/{self.log.public_id}/like/")
        force_authenticate(request, user=self.viewer)
        response = LikePost.as_view()(request, public_id=self.log.public_id)
        # viewer's own like was removed by the toggle; blocked and blocker likes don't count.
        self.assertFalse(response.data["liked"])
        self.assertEqual(response.data["likes_count"], 1)

    def test_own_logs_hide_comments_from_blocked_users(self):
        own = self._log(self.viewer)
        Comment.objects.create(user=self.blocked, log=own, text="nope")
        Comment.objects.create(user=self.plain, log=own, text="yes")
        response = self._call(userLogs, self.viewer)
        row = next(r for r in response.data["results"] if r["id"] == own.id)
        self.assertEqual({c["user"] for c in row["comments"]}, {"plainguy"})

    def test_a_profiles_logs_hide_comments_from_blocked_users(self):
        response = self._call(ProfileDetailById, self.viewer, user_id=self.plain.id)
        comments = response.data["user_logs"][0]["comments"]
        self.assertEqual({c["user"] for c in comments}, {"viewer", "plainguy"})


class PeopleSurfaceTests(BlockFilteringCase):
    def _ids(self, response):
        return {row["id"] for row in response.data["results"]}

    def test_user_search_hides_blocked_users_both_ways(self):
        found = self._ids(self._call(UserSearch, self.viewer, query="?q=guy"))
        self.assertEqual(found, {self.plain.id})
        found = self._ids(self._call(UserSearch, self.blocked, query="?q=guy"))
        self.assertNotIn(self.viewer.id, found)
        self.assertIn(self.plain.id, found)

    def test_suggested_users_hide_blocked_users_both_ways(self):
        ids = {row["id"] for row in self._call(SuggestedUsers, self.viewer).data}
        self.assertEqual(ids, {self.plain.id})
        ids = {row["id"] for row in self._call(SuggestedUsers, self.blocker).data}
        self.assertNotIn(self.viewer.id, ids)

    def test_followers_and_following_lists_hide_blocked_users(self):
        friend = self._user("friendguy")
        for user in (self.blocked, self.blocker, friend):
            Follow.objects.create(follower=user, followee=self.plain)
            Follow.objects.create(follower=self.plain, followee=user)
        followers = self._ids(self._call(FollowersList, self.viewer, user_id=self.plain.id))
        following = self._ids(self._call(FollowingList, self.viewer, user_id=self.plain.id))
        self.assertEqual(followers, {friend.id})
        self.assertEqual(following, {friend.id})

    def test_follow_lists_of_a_blocked_user_are_404(self):
        for view in (FollowersList, FollowingList):
            self.assertEqual(self._call(view, self.viewer, user_id=self.blocked.id).status_code, 404)
            self.assertEqual(self._call(view, self.viewer, user_id=self.blocker.id).status_code, 404)

    def test_profile_of_a_blocked_user_is_404_both_ways(self):
        self.assertEqual(self._call(ProfileDetailById, self.viewer, user_id=self.blocked.id).status_code, 404)
        self.assertEqual(self._call(ProfileDetailById, self.viewer, user_id=self.blocker.id).status_code, 404)
        self.assertEqual(self._call(ProfileDetailById, self.blocked, user_id=self.viewer.id).status_code, 404)

    def test_profile_counts_exclude_blocked_users_per_viewer(self):
        friend = self._user("friendguy")
        Follow.objects.create(follower=self.blocked, followee=self.plain)
        Follow.objects.create(follower=self.plain, followee=self.blocked)
        Follow.objects.create(follower=self.plain, followee=friend)

        seen_by_viewer = self._call(ProfileDetailById, self.viewer, user_id=self.plain.id).data
        seen_by_friend = self._call(ProfileDetailById, friend, user_id=self.plain.id).data

        # `blocked` is hidden from viewer, so viewer sees neither follow involving them.
        self.assertEqual(seen_by_viewer["followers_count"], 0)
        self.assertEqual(seen_by_viewer["following_count"], 1)
        # Someone with no block sees the global numbers.
        self.assertEqual(seen_by_friend["followers_count"], 1)
        self.assertEqual(seen_by_friend["following_count"], 2)

    def test_user_list_hides_blocked_users(self):
        ids = self._ids(self._call(UserList, self.viewer))
        self.assertNotIn(self.blocked.id, ids)
        self.assertNotIn(self.blocker.id, ids)
        self.assertIn(self.plain.id, ids)


class ListSurfaceTests(BlockFilteringCase):
    def setUp(self):
        super().setUp()
        self.lists = {u.username: self._list(u, f"{u.username} list") for u in
                      (self.viewer, self.blocked, self.blocker, self.plain)}

    def _owners(self, response):
        return {row["owner"] for row in response.data["results"]}

    def test_collection_list_hides_blocked_owners_both_ways(self):
        self.assertEqual(self._owners(self._call(CollectionList, self.viewer)), {"viewer", "plainguy"})
        self.assertNotIn("viewer", self._owners(self._call(CollectionList, self.blocked)))

    def test_collection_list_is_unfiltered_for_anonymous(self):
        self.assertEqual(len(self._call(CollectionList, None).data["results"]), 4)

    def test_collection_search_hides_blocked_owners(self):
        response = self._call(CollectionSearch, self.viewer, query="?q=list")
        self.assertEqual(self._owners(response), {"viewer", "plainguy"})

    def test_collection_detail_of_a_blocked_owner_is_404_both_ways(self):
        for name in ("blockedguy", "blockerguy"):
            response = self._call(CollectionDetail, self.viewer, public_id=self.lists[name].public_id)
            self.assertEqual(response.status_code, 404, name)
        response = self._call(CollectionDetail, self.blocked, public_id=self.lists["viewer"].public_id)
        self.assertEqual(response.status_code, 404)

    def test_collection_detail_still_works_for_unrelated_lists(self):
        response = self._call(CollectionDetail, self.viewer, public_id=self.lists["plainguy"].public_id)
        self.assertEqual(response.status_code, 200)
