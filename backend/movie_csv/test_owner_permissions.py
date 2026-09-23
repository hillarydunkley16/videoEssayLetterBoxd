"""Only a log's owner may edit or delete it via /api/logList/<uuid>/ or
/api/logList/<uuid>/delete. `logDetail` and `DeleteLog` previously only checked
`IsAuthenticated`, so any signed-in user could PATCH/PUT/DELETE any other user's log.
`CollectionDetail` already enforces this (see test_collection_owner.py); this file
covers the two remaining endpoints. ClerkAuthentication is bypassed with
force_authenticate.
"""
from django.contrib.auth import get_user_model
from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIRequestFactory, force_authenticate

from movie_csv.models import Log, VideoEssay
from movie_csv.views.api import DeleteLog, logDetail

User = get_user_model()


class OwnerPermissionTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.owner = User.objects.create(username="user_2ownerClerkId")
        self.other = User.objects.create(username="user_2otherClerkId")
        self.essay = VideoEssay.objects.create(title="E", owner=self.owner)
        self.log = Log.objects.create(
            date="2026-01-01",
            essay=self.essay,
            owner=self.owner,
            review_text="original",
            rating=4,
            rewatch=False,
        )

    def _detail(self, method, viewer, data=None, **kwargs):
        request = getattr(self.factory, method)(
            "/api/anything/", data or {}, format="json"
        )
        if viewer is not None:
            force_authenticate(request, user=viewer)
        return logDetail.as_view()(request, public_id=self.log.public_id, **kwargs)

    def _delete_log(self, viewer):
        request = self.factory.delete("/api/anything/")
        if viewer is not None:
            force_authenticate(request, user=viewer)
        return DeleteLog.as_view()(request, public_id=self.log.public_id)

    # --- logDetail: PATCH -----------------------------------------------

    def test_owner_can_patch_their_log(self):
        response = self._detail("patch", self.owner, {"review_text": "updated"})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.log.refresh_from_db()
        self.assertEqual(self.log.review_text, "updated")

    def test_another_user_cannot_patch_the_log(self):
        response = self._detail("patch", self.other, {"review_text": "hijacked"})
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.log.refresh_from_db()
        self.assertEqual(self.log.review_text, "original")

    # --- logDetail: PUT ---------------------------------------------------

    def test_another_user_cannot_put_the_log(self):
        response = self._detail(
            "put",
            self.other,
            {
                "date": "2026-01-02",
                "essay": self.essay.id,
                "review_text": "hijacked",
                "rating": 1,
                "rewatch": True,
            },
        )
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.log.refresh_from_db()
        self.assertEqual(self.log.review_text, "original")

    # --- logDetail: DELETE --------------------------------------------

    def test_another_user_cannot_delete_the_log_via_detail(self):
        response = self._detail("delete", self.other)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Log.objects.filter(pk=self.log.pk).exists())

    def test_owner_can_delete_their_log_via_detail(self):
        response = self._detail("delete", self.owner)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Log.objects.filter(pk=self.log.pk).exists())

    # --- logDetail: GET is unaffected --------------------------------------

    def test_another_user_can_still_read_the_log(self):
        request = self.factory.get("/api/anything/")
        force_authenticate(request, user=self.other)
        response = logDetail.as_view()(request, public_id=self.log.public_id)
        self.assertEqual(response.status_code, status.HTTP_200_OK)

    # --- DeleteLog ----------------------------------------------------------

    def test_another_user_cannot_delete_the_log_via_delete_endpoint(self):
        response = self._delete_log(self.other)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
        self.assertTrue(Log.objects.filter(pk=self.log.pk).exists())

    def test_owner_can_delete_their_log_via_delete_endpoint(self):
        response = self._delete_log(self.owner)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(Log.objects.filter(pk=self.log.pk).exists())
