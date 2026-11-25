"""Tests for GET /api/users/username-available/.

Public (no Clerk token needed — there is no session yet at this point in sign-up, see
SPEC-username-onboarding.md decision 2/3). Checks against Profile.display_username only;
Clerk remains the final authority on uniqueness at signUp.create() time.
"""
from django.contrib.auth import get_user_model
from django.db import connection
from django.test import TestCase
from django.test.utils import CaptureQueriesContext
from rest_framework.test import APIClient, APIRequestFactory

from movie_csv.views.api import UsernameAvailability

User = get_user_model()


def _make_user(clerk_id, display_username):
    user = User.objects.create(username=clerk_id)
    user.profile.display_username = display_username
    user.profile.save()
    return user


class UsernameAvailabilityTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()

    def _get(self, u):
        request = self.factory.get("/api/users/username-available/", {"u": u})
        return UsernameAvailability.as_view()(request)

    def test_an_unused_username_is_available_with_no_suggestions(self):
        response = self._get("brandnewname")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data, {"available": True, "suggestions": []})

    def test_a_taken_username_is_unavailable_with_at_least_three_suggestions(self):
        _make_user("user_2aClerkId", "janedoe")
        response = self._get("janedoe")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.data["available"])
        self.assertGreaterEqual(len(response.data["suggestions"]), 3)

    def test_the_check_is_case_insensitive(self):
        _make_user("user_2aClerkId", "JaneDoe")
        response = self._get("janedoe")
        self.assertFalse(response.data["available"])

    def test_every_suggestion_is_itself_available(self):
        _make_user("user_2aClerkId", "janedoe")
        _make_user("user_2bClerkId", "janedoe1")
        _make_user("user_2cClerkId", "janedoe2")
        response = self._get("janedoe")
        suggestions = response.data["suggestions"]
        taken = {"janedoe", "janedoe1", "janedoe2"}
        for suggestion in suggestions:
            self.assertNotIn(suggestion.lower(), taken)

    def test_suggestions_do_not_collide_with_each_other(self):
        _make_user("user_2aClerkId", "janedoe")
        response = self._get("janedoe")
        suggestions = response.data["suggestions"]
        self.assertEqual(len(suggestions), len(set(s.lower() for s in suggestions)))

    def test_empty_candidate_is_rejected_not_treated_as_available(self):
        response = self._get("")
        self.assertEqual(response.status_code, 400)

    def test_too_short_candidate_is_rejected(self):
        response = self._get("ab")
        self.assertEqual(response.status_code, 400)

    def test_candidate_with_invalid_characters_is_rejected(self):
        response = self._get("jane doe!")
        self.assertEqual(response.status_code, 400)

    def test_constant_query_count_regardless_of_how_many_similar_names_exist(self):
        _make_user("user_2aClerkId", "janedoe")
        with CaptureQueriesContext(connection) as first:
            self._get("janedoe")
        baseline = len(first.captured_queries)

        for i in range(1, 6):
            _make_user(f"user_2extra{i}ClerkId", f"janedoe{i}")
        with CaptureQueriesContext(connection) as second:
            self._get("janedoe")
        self.assertEqual(len(second.captured_queries), baseline)


class UsernameAvailabilityRouteTests(TestCase):
    """Through the URL router and the real auth stack — no token required."""

    def test_route_works_with_no_authorization_header_at_all(self):
        client = APIClient()
        response = client.get("/api/users/username-available/?u=brandnewname")
        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["available"])
