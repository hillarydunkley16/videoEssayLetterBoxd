"""Tests for the /api/search/ view (movie_csv.views.api.youtube_search).

SerpAPI is mocked — these cover the view's own contract: input validation,
the missing-key case, timeouts, and passthrough of a good response. The
actual SerpAPI call now happens inside movie_csv.tasks.run_youtube_search
(run eagerly/synchronously with no REDIS_URL configured), so that's what
gets mocked rather than movie_csv.views.api.requests.get directly.
"""
import json
import threading
from unittest import mock

import requests
from celery._state import _set_task_join_will_block
from celery.exceptions import TimeoutError as CeleryTimeoutError
from django.core.cache import cache
from django.test import Client, SimpleTestCase

URL = "/api/search/"


def _post(client, body, raw=None):
    return client.post(
        URL,
        data=raw if raw is not None else json.dumps(body),
        content_type="application/json",
    )


class YoutubeSearchViewTests(SimpleTestCase):
    def setUp(self):
        # Results (and the per-IP rate-limit counter) are cached; clear so
        # each test hits the mocked SerpAPI call instead of a prior test's cache.
        cache.clear()

    def test_missing_query_returns_400(self):
        self.assertEqual(_post(self.client, {}).status_code, 400)

    def test_invalid_json_body_returns_400_not_500(self):
        self.assertEqual(_post(self.client, None, raw="}{ not json").status_code, 400)

    @mock.patch("movie_csv.views.api.os.getenv", return_value=None)
    @mock.patch("movie_csv.tasks.requests.get")
    def test_missing_api_key_returns_503_without_calling_serpapi(self, mget, _getenv):
        r = _post(self.client, {"q": "contrapoints"})
        self.assertEqual(r.status_code, 503)
        mget.assert_not_called()

    @mock.patch("movie_csv.views.api.os.getenv", return_value="test-key")
    @mock.patch("movie_csv.tasks.requests.get")
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
        "movie_csv.tasks.requests.get",
        side_effect=requests.exceptions.Timeout,
    )
    def test_serpapi_timeout_returns_504_not_500(self, mget, _getenv):
        self.assertEqual(_post(self.client, {"q": "essay"}).status_code, 504)

    @mock.patch("movie_csv.views.api.os.getenv", return_value="test-key")
    @mock.patch(
        "movie_csv.tasks.requests.get",
        side_effect=requests.exceptions.ConnectionError,
    )
    def test_serpapi_unreachable_returns_502(self, mget, _getenv):
        self.assertEqual(_post(self.client, {"q": "essay"}).status_code, 502)

    @mock.patch("movie_csv.views.api.os.getenv", return_value="bad-key")
    @mock.patch("movie_csv.tasks.requests.get")
    def test_serpapi_4xx_normalized_to_502(self, mget, _getenv):
        mget.return_value = mock.Mock(
            status_code=401,
            text='{"error": "Invalid API key"}',
            json=lambda: {"error": "Invalid API key"},
        )
        self.assertEqual(_post(self.client, {"q": "essay"}).status_code, 502)

    @mock.patch("movie_csv.views.api.os.getenv", return_value="test-key")
    @mock.patch("movie_csv.tasks.requests.get")
    def test_signed_out_search_is_allowed_even_with_a_stale_token(self, mget, _getenv):
        # The signed-out landing page searches with no credentials, and a visitor whose Clerk
        # session just expired may still send an old Bearer token. Neither may get a 401/403.
        mget.return_value = mock.Mock(status_code=200, json=lambda: {"video_results": []})
        anonymous = _post(self.client, {"q": "essay"})
        stale = self.client.post(
            URL,
            data=json.dumps({"q": "essay again"}),
            content_type="application/json",
            HTTP_AUTHORIZATION="Bearer expired.or.invalid",
        )
        self.assertEqual((anonymous.status_code, stale.status_code), (200, 200))

    @mock.patch("movie_csv.views.api.os.getenv", return_value="test-key")
    @mock.patch("movie_csv.tasks.requests.get")
    def test_overlapping_searches_do_not_wedge_later_searches(self, mget, _getenv):
        # Celery's eager path marks "a task is running" in a process-wide flag (not per
        # thread) and restores the value it saw on entry. When two requests overlap and
        # the first one leaves before the second, the flag is restored to True and stays
        # there, so every later result.get() raised "Never call result.get() within a
        # task!" (a 500) until the process restarted. The landing page makes overlap
        # likely: each new keystroke abandons the previous request, but the server keeps
        # running it. Order matters, so the test forces A to finish before B.
        both_inside = threading.Barrier(2)
        a_done = threading.Event()

        def slow_get(*args, **kwargs):
            both_inside.wait(timeout=5)
            if threading.current_thread().name == "B":
                a_done.wait(timeout=5)
            return mock.Mock(status_code=200, json=lambda: {"video_results": []})

        mget.side_effect = slow_get
        codes = {}

        def search(name):
            codes[name] = _post(Client(), {"q": f"overlap {name}"}).status_code
            if name == "A":
                a_done.set()

        threads = [threading.Thread(target=search, args=(n,), name=n) for n in ("A", "B")]
        try:
            for t in threads:
                t.start()
            for t in threads:
                t.join(timeout=10)
            mget.side_effect = None
            mget.return_value = mock.Mock(status_code=200, json=lambda: {"video_results": []})
            later = _post(self.client, {"q": "after the overlap"}).status_code
        finally:
            _set_task_join_will_block(False)  # don't leak a stuck flag into other tests

        self.assertEqual(codes, {"A": 200, "B": 200})
        self.assertEqual(later, 200)

    def test_get_not_allowed(self):
        self.assertEqual(self.client.get(URL).status_code, 405)

    @mock.patch("movie_csv.views.api.os.getenv", return_value="test-key")
    @mock.patch("movie_csv.views.api.run_youtube_search")
    def test_celery_result_timeout_returns_504_not_500(self, mtask, _getenv):
        mtask.delay.return_value.get.side_effect = CeleryTimeoutError
        self.assertEqual(_post(self.client, {"q": "essay"}).status_code, 504)

    @mock.patch("movie_csv.views.api.os.getenv", return_value="test-key")
    @mock.patch("movie_csv.tasks.requests.get")
    def test_rate_limit_returns_429_after_limit(self, mget, _getenv):
        mget.return_value = mock.Mock(status_code=200, json=lambda: {"video_results": []})
        with mock.patch("movie_csv.views.api.YOUTUBE_SEARCH_RATE_LIMIT", 2):
            codes = [_post(self.client, {"q": f"essay {i}"}).status_code for i in range(3)]
        self.assertEqual(codes, [200, 200, 429])

    @mock.patch("movie_csv.views.api.os.getenv", return_value="test-key")
    @mock.patch("movie_csv.tasks.requests.get")
    def test_rate_limit_ignores_spoofed_leading_forwarded_for(self, mget, _getenv):
        mget.return_value = mock.Mock(status_code=200, json=lambda: {"video_results": []})
        with mock.patch("movie_csv.views.api.YOUTUBE_SEARCH_RATE_LIMIT", 1):
            codes = [
                self.client.post(
                    URL,
                    data=json.dumps({"q": f"essay {i}"}),
                    content_type="application/json",
                    HTTP_X_FORWARDED_FOR=f"1.2.3.{i}, 9.9.9.9",
                ).status_code
                for i in range(2)
            ]
        self.assertEqual(codes, [200, 429])
