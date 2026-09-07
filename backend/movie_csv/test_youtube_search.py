"""Tests for the /api/search/ view (movie_csv.views.api.youtube_search).

SerpAPI is mocked — these cover the view's own contract: input validation,
the missing-key case, timeouts, and passthrough of a good response.
"""
import json
from unittest import mock

import requests
from django.test import SimpleTestCase

URL = "/api/search/"


def _post(client, body, raw=None):
    return client.post(
        URL,
        data=raw if raw is not None else json.dumps(body),
        content_type="application/json",
    )


class YoutubeSearchViewTests(SimpleTestCase):
    def test_missing_query_returns_400(self):
        self.assertEqual(_post(self.client, {}).status_code, 400)

    def test_invalid_json_body_returns_400_not_500(self):
        self.assertEqual(_post(self.client, None, raw="}{ not json").status_code, 400)

    @mock.patch("movie_csv.views.api.os.getenv", return_value=None)
    @mock.patch("movie_csv.views.api.requests.get")
    def test_missing_api_key_returns_503_without_calling_serpapi(self, mget, _getenv):
        r = _post(self.client, {"q": "contrapoints"})
        self.assertEqual(r.status_code, 503)
        mget.assert_not_called()

    @mock.patch("movie_csv.views.api.os.getenv", return_value="test-key")
    @mock.patch("movie_csv.views.api.requests.get")
    def test_happy_path_passes_serpapi_json_through_with_a_timeout(self, mget, _getenv):
        mget.return_value = mock.Mock(
            status_code=200, json=lambda: {"video_results": [{"title": "Essay"}]}
        )
        r = _post(self.client, {"q": "essay"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["video_results"][0]["title"], "Essay")
        self.assertIn("timeout", mget.call_args.kwargs)

    @mock.patch("movie_csv.views.api.os.getenv", return_value="test-key")
    @mock.patch(
        "movie_csv.views.api.requests.get",
        side_effect=requests.exceptions.Timeout,
    )
    def test_serpapi_timeout_returns_504_not_500(self, mget, _getenv):
        self.assertEqual(_post(self.client, {"q": "essay"}).status_code, 504)

    @mock.patch("movie_csv.views.api.os.getenv", return_value="test-key")
    @mock.patch(
        "movie_csv.views.api.requests.get",
        side_effect=requests.exceptions.ConnectionError,
    )
    def test_serpapi_unreachable_returns_502(self, mget, _getenv):
        self.assertEqual(_post(self.client, {"q": "essay"}).status_code, 502)

    @mock.patch("movie_csv.views.api.os.getenv", return_value="bad-key")
    @mock.patch("movie_csv.views.api.requests.get")
    def test_serpapi_4xx_normalized_to_502(self, mget, _getenv):
        mget.return_value = mock.Mock(
            status_code=401,
            text='{"error": "Invalid API key"}',
            json=lambda: {"error": "Invalid API key"},
        )
        self.assertEqual(_post(self.client, {"q": "essay"}).status_code, 502)

    def test_get_not_allowed(self):
        self.assertEqual(self.client.get(URL).status_code, 405)
