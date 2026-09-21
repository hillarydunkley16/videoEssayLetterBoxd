"""Tests for movie_csv.views.api.DeleteAccount (DELETE /api/account/).

ClerkAuthentication is bypassed with force_authenticate for the data rules; one test
goes through the real URL to confirm unauthenticated requests are rejected.
"""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIClient, APIRequestFactory, force_authenticate

from movie_csv.models import Collection, Comment, Like, Log, VideoEssay
from movie_csv.views.api import DeleteAccount
from users.models import Follow, Profile

User = get_user_model()
URL = "/api/account/"


class DeleteAccountTests(TestCase):
    def setUp(self):
        self.me = User.objects.create(username="me")
        self.other = User.objects.create(username="other")
        self.view = DeleteAccount.as_view()
        self.factory = APIRequestFactory()

    def _delete(self, user):
        request = self.factory.delete(URL)
        force_authenticate(request, user=user)
        return self.view(request)

    def _log(self, essay, owner, **kw):
        return Log.objects.create(essay=essay, owner=owner, date="2026-09-07", rating=4, **kw)

    def test_unauthenticated_is_rejected(self):
        response = APIClient().delete(URL)
        self.assertIn(response.status_code, (401, 403))
        self.assertTrue(User.objects.filter(pk=self.me.pk).exists())

    def test_deletes_caller_and_their_data(self):
        mine = VideoEssay.objects.create(title="Mine", owner=self.me)
        self._log(mine, self.me)
        Collection.objects.create(owner=self.me, name="L")
        response = self._delete(self.me)
        self.assertEqual(response.status_code, 204)
        self.assertFalse(User.objects.filter(pk=self.me.pk).exists())
        self.assertTrue(Profile.objects.filter(user_id=self.other.pk).exists())
        self.assertFalse(Profile.objects.filter(user_id=self.me.pk).exists())
        self.assertFalse(Log.objects.filter(owner_id=self.me.pk).exists())
        self.assertFalse(Collection.objects.filter(owner_id=self.me.pk).exists())
        self.assertFalse(VideoEssay.objects.filter(title="Mine").exists())

    def test_other_users_data_untouched(self):
        theirs = VideoEssay.objects.create(title="Theirs", owner=self.other)
        their_log = self._log(theirs, self.other)
        Comment.objects.create(user=self.me, log=their_log, text="hi")
        Like.objects.create(user=self.me, post=their_log)
        self._delete(self.me)
        self.assertTrue(User.objects.filter(pk=self.other.pk).exists())
        self.assertTrue(VideoEssay.objects.filter(pk=theirs.pk).exists())
        self.assertTrue(Log.objects.filter(pk=their_log.pk).exists())
        self.assertFalse(Comment.objects.filter(log=their_log).exists())
        self.assertFalse(Like.objects.filter(post=their_log).exists())

    def test_follow_relations_removed_both_ways(self):
        Follow.objects.create(follower=self.me, followee=self.other)
        Follow.objects.create(follower=self.other, followee=self.me)
        self._delete(self.me)
        self.assertEqual(Follow.objects.count(), 0)

    def test_essay_logged_by_others_survives_with_new_owner(self):
        essay = VideoEssay.objects.create(title="Shared", owner=self.me)
        their_log = self._log(essay, self.other)
        self._delete(self.me)
        essay.refresh_from_db()
        self.assertEqual(essay.owner_id, self.other.pk)
        self.assertTrue(Log.objects.filter(pk=their_log.pk).exists())

    def test_essay_only_in_others_list_survives(self):
        essay = VideoEssay.objects.create(title="Listed", owner=self.me)
        lst = Collection.objects.create(owner=self.other, name="L")
        lst.essays.add(essay)
        self._delete(self.me)
        essay.refresh_from_db()
        self.assertEqual(essay.owner_id, self.other.pk)
        self.assertIn(essay, lst.essays.all())
