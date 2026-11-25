"""Owner edits to a log via PATCH /api/logList/<uuid>/.

Ownership (403 for non-owners) is covered in test_owner_permissions.py; this file
covers what an owner may change: rating, review_text, date and rewatch. The essay
is fixed once a log is created. ClerkAuthentication is bypassed with force_authenticate.
"""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIRequestFactory, force_authenticate

from movie_csv.models import Log, VideoEssay
from movie_csv.views.api import logDetail

User = get_user_model()


class LogEditTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.owner = User.objects.create(username="user_2ownerClerkId")
        self.essay = VideoEssay.objects.create(title="E", owner=self.owner)
        self.other_essay = VideoEssay.objects.create(title="Other", owner=self.owner)
        self.log = Log.objects.create(
            date="2026-01-01",
            essay=self.essay,
            owner=self.owner,
            review_text="original",
            rating=4,
            rewatch=False,
        )

    def _patch(self, data):
        request = self.factory.patch("/api/anything/", data, format="json")
        force_authenticate(request, user=self.owner)
        return logDetail.as_view()(request, public_id=self.log.public_id)

    def test_owner_can_update_all_editable_fields(self):
        response = self._patch(
            {"rating": 2, "review_text": "changed", "date": "2026-02-03", "rewatch": True}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.log.refresh_from_db()
        self.assertEqual(self.log.rating, 2)
        self.assertEqual(self.log.review_text, "changed")
        self.assertEqual(str(self.log.date), "2026-02-03")
        self.assertTrue(self.log.rewatch)

    def test_essay_in_patch_is_ignored(self):
        response = self._patch(
            {"essay": str(self.other_essay.public_id), "review_text": "changed"}
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.log.refresh_from_db()
        self.assertEqual(self.log.essay_id, self.essay.id)
        self.assertEqual(self.log.review_text, "changed")

    def test_rating_out_of_range_is_rejected(self):
        response = self._patch({"rating": 6})
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.log.refresh_from_db()
        self.assertEqual(self.log.rating, 4)
