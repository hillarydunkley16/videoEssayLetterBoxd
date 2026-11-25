"""Tests for movie_csv.services.youtube_oembed.fetch_oembed_metadata.

The real YouTube oEmbed HTTP call is mocked throughout.
"""
from unittest import mock

import requests
from django.test import SimpleTestCase

from movie_csv.services.youtube_oembed import OEmbedLookupError, fetch_oembed_metadata


class FetchOembedMetadataTests(SimpleTestCase):
    @mock.patch("movie_csv.services.youtube_oembed.requests.get")
    def test_happy_path_maps_oembed_fields(self, mget):
        mget.return_value = mock.Mock(
            status_code=200,
            json=lambda: {
                "title": "The Life & Filthy Legacy of Divine",
                "author_name": "FatspoPod",
                "thumbnail_url": "https://i.ytimg.com/vi/abc123/hqdefault.jpg",
            },
        )
        result = fetch_oembed_metadata("abc123")
        self.assertEqual(result["title"], "The Life & Filthy Legacy of Divine")
        self.assertEqual(result["channel_name"], "FatspoPod")
        self.assertEqual(result["thumbnail"], "https://i.ytimg.com/vi/abc123/hqdefault.jpg")
        self.assertIn("timeout", mget.call_args.kwargs)

    @mock.patch("movie_csv.services.youtube_oembed.requests.get")
    def test_404_raises_oembed_lookup_error(self, mget):
        mget.return_value = mock.Mock(status_code=404, json=lambda: {})
        with self.assertRaises(OEmbedLookupError):
            fetch_oembed_metadata("deleted-video")

    @mock.patch(
        "movie_csv.services.youtube_oembed.requests.get",
        side_effect=requests.exceptions.Timeout,
    )
    def test_network_timeout_raises_oembed_lookup_error_not_requests_exception(self, mget):
        with self.assertRaises(OEmbedLookupError):
            fetch_oembed_metadata("abc123")
