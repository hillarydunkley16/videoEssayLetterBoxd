"""Tests for POST /api/users/age-confirmation/ (movie_csv.views.api.AgeConfirmation).

Visitors tick "I confirm I am 16 or older" before they have an account, so the frontend holds
the tick and reports it once they are signed in. The server records when it heard it, on the
user's Profile, and never lets a repeat move that date. The tick itself is the visitor's own
statement; what is stored is the time the server received it, not a client-supplied value.

ClerkAuthentication is bypassed with force_authenticate; these cover the view's own behavior.
"""
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from movie_csv.views.api import AgeConfirmation
from users.models import Profile

User = get_user_model()
URL = "/api/users/age-confirmation/"


class AgeConfirmationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create(username="clerk_user")
        self.view = AgeConfirmation.as_view()
        self.factory = APIRequestFactory()

    def _post(self, user="default"):
        request = self.factory.post(URL, {}, format="json")
        if user == "default":
            user = self.user
        if user is not None:
            force_authenticate(request, user=user)
        return self.view(request)

    def test_records_when_the_server_heard_the_confirmation(self):
        before = timezone.now()
        response = self._post()
        after = timezone.now()

        self.assertEqual(response.status_code, 200)
        confirmed = Profile.objects.get(user=self.user).age_confirmed_at
        self.assertIsNotNone(confirmed)
        self.assertTrue(before <= confirmed <= after)
        self.assertIn("age_confirmed_at", response.data)

    def test_works_when_the_user_has_no_profile_yet(self):
        # A profile is normally created with the user; make sure the view copes without one.
        Profile.objects.filter(user=self.user).delete()
        self.assertEqual(self._post().status_code, 200)
        self.assertTrue(Profile.objects.filter(user=self.user).exists())

    def test_a_repeat_keeps_the_first_date(self):
        self._post()
        first = Profile.objects.get(user=self.user).age_confirmed_at

        response = self._post()

        self.assertEqual(response.status_code, 200)
        self.assertEqual(Profile.objects.get(user=self.user).age_confirmed_at, first)

    def test_one_users_confirmation_does_not_touch_another_profile(self):
        other = User.objects.create(username="someone_else")
        Profile.objects.get_or_create(user=other)
        self._post()
        self.assertIsNone(Profile.objects.get(user=other).age_confirmed_at)

    def test_requires_a_signed_in_user(self):
        self.assertIn(self._post(user=None).status_code, (401, 403))

    def test_the_date_is_not_exposed_on_profile_responses(self):
        from movie_csv.serializers import ProfileSerializer

        self.assertNotIn("age_confirmed_at", ProfileSerializer.Meta.fields)

    def test_get_is_not_allowed(self):
        request = self.factory.get(URL)
        force_authenticate(request, user=self.user)
        self.assertEqual(self.view(request).status_code, 405)
