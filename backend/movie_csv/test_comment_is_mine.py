"""Each comment says whether the viewer wrote it, so the app can hide Report on your own."""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from movie_csv.models import Comment, Log, VideoEssay
from movie_csv.views.api import CommentOnPost, logDetail

User = get_user_model()


class CommentIsMineTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.me = User.objects.create(username="me")
        self.other = User.objects.create(username="other")
        essay = VideoEssay.objects.create(title="E", owner=self.other)
        self.log = Log.objects.create(owner=self.other, essay=essay, date="2026-09-20", rating=3)
        self.mine = Comment.objects.create(user=self.me, log=self.log, text="mine")
        self.theirs = Comment.objects.create(user=self.other, log=self.log, text="theirs")

    def _comments(self, viewer):
        request = self.factory.get("/x/")
        force_authenticate(request, user=viewer)
        response = logDetail.as_view()(request, public_id=self.log.public_id)
        return {c["id"]: c["is_mine"] for c in response.data["log"]["comments"]}

    def test_is_mine_is_relative_to_the_viewer(self):
        self.assertEqual(self._comments(self.me), {self.mine.id: True, self.theirs.id: False})
        self.assertEqual(self._comments(self.other), {self.mine.id: False, self.theirs.id: True})

    def test_a_new_comment_is_mine_for_its_author(self):
        request = self.factory.post(f"/x/", {"text": "hello"}, format="json")
        force_authenticate(request, user=self.me)
        response = CommentOnPost.as_view()(request, public_id=self.log.public_id)
        self.assertEqual(response.status_code, 201)
        self.assertTrue(response.data["is_mine"])
