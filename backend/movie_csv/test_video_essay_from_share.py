"""Tests for VideoEssayFromYoutubeId (get-or-create a VideoEssay by youtube_id).

Backs the share-to-app flow: a shared YouTube URL resolves to a VideoEssay via
this endpoint, reusing an existing row if one already has that youtube_id.
oEmbed is mocked throughout — ClerkAuthentication is bypassed with
force_authenticate, matching test_collection_owner.py's pattern.
"""
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from movie_csv.models import VideoEssay
from movie_csv.services.youtube_oembed import OEmbedLookupError
from movie_csv.views.api import VideoEssayFromYoutubeId

User = get_user_model()

OEMBED_TARGET = "movie_csv.views.api.fetch_oembed_metadata"


class VideoEssayFromYoutubeIdTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = User.objects.create(username="user_2someClerkId")

    def _post(self, youtube_id, viewer="unset"):
        request = self.factory.post("/api/VideoEssays/from-youtube-id/", {"youtube_id": youtube_id})
        if viewer == "unset":
            viewer = self.user
        if viewer is not None:
            force_authenticate(request, user=viewer)
        return VideoEssayFromYoutubeId.as_view()(request)

    @mock.patch(OEMBED_TARGET)
    def test_creates_a_new_video_essay_from_oembed_metadata(self, mfetch):
        mfetch.return_value = {
            "title": "The Life & Filthy Legacy of Divine",
            "channel_name": "FatspoPod",
            "thumbnail": "https://i.ytimg.com/vi/abc123/hqdefault.jpg",
        }
        response = self._post("abc123")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["title"], "The Life & Filthy Legacy of Divine")
        essay = VideoEssay.objects.get(youtube_id="abc123")
        self.assertEqual(essay.channel_name, "FatspoPod")
        self.assertIsNone(essay.duration)

    @mock.patch(OEMBED_TARGET)
    def test_repeat_call_reuses_existing_row_without_a_second_oembed_call(self, mfetch):
        mfetch.return_value = {
            "title": "Some Title",
            "channel_name": "Some Channel",
            "thumbnail": "https://example.com/thumb.jpg",
        }
        first = self._post("abc123")
        second = self._post("abc123")
        self.assertEqual(first.status_code, 201)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(first.data["public_id"], second.data["public_id"])
        self.assertEqual(VideoEssay.objects.filter(youtube_id="abc123").count(), 1)
        mfetch.assert_called_once()

    @mock.patch(OEMBED_TARGET, side_effect=OEmbedLookupError("not found"))
    def test_unresolvable_youtube_id_returns_clean_4xx_not_500(self, mfetch):
        response = self._post("deleted-video")
        self.assertEqual(response.status_code, 422)
        self.assertEqual(VideoEssay.objects.count(), 0)

    def test_anonymous_post_returns_401_or_403(self):
        response = self._post("abc123", viewer=None)
        self.assertIn(response.status_code, (401, 403))
