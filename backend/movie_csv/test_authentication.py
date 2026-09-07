"""Tests for movie_csv.authentication.ClerkAuthentication.

Clerk's JWKS endpoint and JWT signature verification are mocked — these tests
cover the auth class's own logic (header handling, caching, issuer wiring,
user provisioning), not python-jose or the network.
"""
from unittest import mock

from django.contrib.auth import get_user_model
from django.test import RequestFactory, SimpleTestCase, TestCase, override_settings
from rest_framework.exceptions import AuthenticationFailed

from movie_csv import authentication
from movie_csv.authentication import ClerkAuthentication

User = get_user_model()

_FAKE_JWKS = {"keys": [{"kid": "kid-1", "kty": "RSA", "n": "x", "e": "AQAB"}]}


def _request(authorization=None):
    extra = {"HTTP_AUTHORIZATION": authorization} if authorization else {}
    return RequestFactory().get("/api/anything/", **extra)


class HeaderHandlingTests(SimpleTestCase):
    def test_missing_authorization_header_returns_none(self):
        self.assertIsNone(ClerkAuthentication().authenticate(_request()))

    def test_non_bearer_authorization_header_returns_none(self):
        self.assertIsNone(
            ClerkAuthentication().authenticate(_request("Basic dXNlcjpwdw=="))
        )

    def test_malformed_bearer_token_raises_authentication_failed(self):
        with self.assertRaises(AuthenticationFailed):
            ClerkAuthentication().authenticate(_request("Bearer not-a-jwt"))


class JwksCacheTests(SimpleTestCase):
    def setUp(self):
        authentication.reset_jwks_cache()

    @mock.patch("movie_csv.authentication.requests.get")
    def test_jwks_fetched_once_within_ttl(self, mock_get):
        mock_get.return_value = mock.Mock(json=lambda: _FAKE_JWKS)
        authentication.get_jwks()
        authentication.get_jwks()
        self.assertEqual(mock_get.call_count, 1)

    @mock.patch("movie_csv.authentication.time.monotonic")
    @mock.patch("movie_csv.authentication.requests.get")
    def test_jwks_refetched_after_ttl_expires(self, mock_get, mock_clock):
        mock_get.return_value = mock.Mock(json=lambda: _FAKE_JWKS)
        mock_clock.return_value = 1000.0
        authentication.get_jwks()
        mock_clock.return_value = 1000.0 + authentication.JWKS_CACHE_TTL + 1
        authentication.get_jwks()
        self.assertEqual(mock_get.call_count, 2)


class TokenVerificationTests(TestCase):
    def setUp(self):
        authentication.reset_jwks_cache()

    @mock.patch("movie_csv.authentication.jwt.decode")
    @mock.patch("movie_csv.authentication.jwt.get_unverified_header")
    @mock.patch("movie_csv.authentication.requests.get")
    def test_valid_token_provisions_and_returns_user(self, mock_get, mock_hdr, mock_decode):
        mock_get.return_value = mock.Mock(json=lambda: _FAKE_JWKS)
        mock_hdr.return_value = {"kid": "kid-1"}
        mock_decode.return_value = {"sub": "clerk_abc", "email": "a@example.com"}

        result = ClerkAuthentication().authenticate(_request("Bearer good.token.sig"))

        self.assertIsNotNone(result)
        user, auth = result
        self.assertEqual(user.username, "clerk_abc")
        self.assertTrue(User.objects.filter(username="clerk_abc").exists())

    @mock.patch("movie_csv.authentication.jwt.decode")
    @mock.patch("movie_csv.authentication.jwt.get_unverified_header")
    @mock.patch("movie_csv.authentication.requests.get")
    def test_unknown_kid_triggers_one_jwks_refresh_then_fails(self, mock_get, mock_hdr, mock_decode):
        mock_get.return_value = mock.Mock(json=lambda: _FAKE_JWKS)
        mock_hdr.return_value = {"kid": "kid-unknown"}

        with self.assertRaises(AuthenticationFailed):
            ClerkAuthentication().authenticate(_request("Bearer good.token.sig"))
        # one initial fetch + one refresh on the cache miss
        self.assertEqual(mock_get.call_count, 2)
        mock_decode.assert_not_called()

    @override_settings(
        CLERK_ISSUER="https://prod.clerk.example.com",
        CLERK_ISSUER_LEGACY="https://dev.clerk.example.com",
    )
    @mock.patch("movie_csv.authentication.jwt.decode")
    @mock.patch("movie_csv.authentication.jwt.get_unverified_header")
    @mock.patch("movie_csv.authentication.requests.get")
    def test_decode_accepts_both_configured_issuers(self, mock_get, mock_hdr, mock_decode):
        mock_get.return_value = mock.Mock(json=lambda: _FAKE_JWKS)
        mock_hdr.return_value = {"kid": "kid-1"}
        mock_decode.return_value = {"sub": "clerk_abc"}

        ClerkAuthentication().authenticate(_request("Bearer good.token.sig"))

        issuer_arg = mock_decode.call_args.kwargs["issuer"]
        self.assertIn("https://prod.clerk.example.com", issuer_arg)
        self.assertIn("https://dev.clerk.example.com", issuer_arg)


class SourceHygieneTests(SimpleTestCase):
    def test_no_print_and_no_hardcoded_issuer(self):
        from pathlib import Path

        source = Path(authentication.__file__).read_text()
        self.assertNotIn("print(", source)
        self.assertNotIn("splendid-sunbird-55.clerk.accounts.dev", source)
