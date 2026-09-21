"""Only a row's owner may modify or delete it.

logDetail, DeleteLog and CollectionDetail were guarded by IsAuthenticated alone, so any
signed-in user could PATCH/DELETE anyone's logs and collections. Reads stay open to every
signed-in user (other people's logs and lists are meant to be viewable).
ClerkAuthentication is bypassed with DRF's force_authenticate.
"""
from datetime import date

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from movie_csv.models import Collection, Log, VideoEssay
from movie_csv.permissions import IsOwnerOrReadOnly
from movie_csv.views.api import CollectionDetail, DeleteLog, logDetail

User = get_user_model()


class OwnerPermissionTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.owner = User.objects.create(username="owner")
        self.other = User.objects.create(username="other")
        self.essay = VideoEssay.objects.create(title="An Essay", owner=self.owner)
        self.log = Log.objects.create(
            owner=self.owner, essay=self.essay, date=date(2026, 9, 20), rating=4, review_text="mine"
        )
        self.collection = Collection.objects.create(name="Mine", owner=self.owner)

    def _call(self, view, method, user, data=None, **kwargs):
        request = getattr(self.factory, method)("/api/anything/", data, format="json")
        if user is not None:
            force_authenticate(request, user=user)
        return view(request, **kwargs)

    # --- log detail (PATCH / PUT / DELETE / GET) ---------------------------

    def test_other_user_cannot_patch_a_log(self):
        response = self._call(logDetail.as_view(), "patch", self.other, {"review_text": "hacked"}, public_id=self.log.public_id)
        self.assertEqual(response.status_code, 403)
        self.log.refresh_from_db()
        self.assertEqual(self.log.review_text, "mine")

    def test_other_user_cannot_put_a_log(self):
        payload = {"essay": str(self.essay.public_id), "date": "2026-09-20", "rating": 1, "review_text": "hacked"}
        response = self._call(logDetail.as_view(), "put", self.other, payload, public_id=self.log.public_id)
        self.assertEqual(response.status_code, 403)
        self.log.refresh_from_db()
        self.assertEqual((self.log.rating, self.log.review_text), (4, "mine"))

    def test_other_user_cannot_delete_a_log_via_detail(self):
        response = self._call(logDetail.as_view(), "delete", self.other, public_id=self.log.public_id)
        self.assertEqual(response.status_code, 403)
        self.assertTrue(Log.objects.filter(pk=self.log.pk).exists())

    def test_owner_can_patch_their_log(self):
        response = self._call(logDetail.as_view(), "patch", self.owner, {"review_text": "edited"}, public_id=self.log.public_id)
        self.assertEqual(response.status_code, 200)
        self.log.refresh_from_db()
        self.assertEqual(self.log.review_text, "edited")

    def test_owner_can_delete_their_log_via_detail(self):
        response = self._call(logDetail.as_view(), "delete", self.owner, public_id=self.log.public_id)
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Log.objects.filter(pk=self.log.pk).exists())

    def test_other_user_can_still_read_a_log(self):
        response = self._call(logDetail.as_view(), "get", self.other, public_id=self.log.public_id)
        self.assertEqual(response.status_code, 200)

    # --- delete log endpoint -----------------------------------------------

    def test_other_user_cannot_delete_a_log_via_delete_endpoint(self):
        response = self._call(DeleteLog.as_view(), "delete", self.other, public_id=self.log.public_id)
        self.assertEqual(response.status_code, 403)
        self.assertTrue(Log.objects.filter(pk=self.log.pk).exists())

    def test_owner_can_delete_their_log_via_delete_endpoint(self):
        response = self._call(DeleteLog.as_view(), "delete", self.owner, public_id=self.log.public_id)
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Log.objects.filter(pk=self.log.pk).exists())

    def test_unauthenticated_cannot_delete_a_log(self):
        response = self._call(DeleteLog.as_view(), "delete", None, public_id=self.log.public_id)
        self.assertIn(response.status_code, (401, 403))
        self.assertTrue(Log.objects.filter(pk=self.log.pk).exists())

    # --- collection detail ---------------------------------------------------

    def test_other_user_cannot_patch_a_collection(self):
        response = self._call(CollectionDetail.as_view(), "patch", self.other, {"name": "hacked"}, public_id=self.collection.public_id)
        self.assertEqual(response.status_code, 403)
        self.collection.refresh_from_db()
        self.assertEqual(self.collection.name, "Mine")

    def test_other_user_cannot_put_a_collection(self):
        response = self._call(CollectionDetail.as_view(), "put", self.other, {"name": "hacked", "description": ""}, public_id=self.collection.public_id)
        self.assertEqual(response.status_code, 403)
        self.collection.refresh_from_db()
        self.assertEqual(self.collection.name, "Mine")

    def test_other_user_cannot_delete_a_collection(self):
        response = self._call(CollectionDetail.as_view(), "delete", self.other, public_id=self.collection.public_id)
        self.assertEqual(response.status_code, 403)
        self.assertTrue(Collection.objects.filter(pk=self.collection.pk).exists())

    def test_owner_can_patch_their_collection(self):
        response = self._call(CollectionDetail.as_view(), "patch", self.owner, {"name": "Renamed"}, public_id=self.collection.public_id)
        self.assertEqual(response.status_code, 200)
        self.collection.refresh_from_db()
        self.assertEqual(self.collection.name, "Renamed")

    def test_owner_can_delete_their_collection(self):
        response = self._call(CollectionDetail.as_view(), "delete", self.owner, public_id=self.collection.public_id)
        self.assertEqual(response.status_code, 204)
        self.assertFalse(Collection.objects.filter(pk=self.collection.pk).exists())

    def test_other_user_can_still_read_a_collection(self):
        response = self._call(CollectionDetail.as_view(), "get", self.other, public_id=self.collection.public_id)
        self.assertEqual(response.status_code, 200)


class IsOwnerOrReadOnlyUnitTests(SimpleTestCase):
    """The permission class itself: DRF calls has_object_permission (singular)."""

    def _request(self, method, user):
        request = getattr(APIRequestFactory(), method)("/x/")
        request.user = user
        return request

    def test_defines_the_hook_drf_actually_calls(self):
        # BasePermission already defines it (allow-all), so check the class overrides it.
        self.assertIn("has_object_permission", vars(IsOwnerOrReadOnly))

    def test_safe_methods_are_allowed_for_anyone(self):
        owner, other = object(), object()
        obj = type("Obj", (), {"owner": owner})()
        for method in ("get", "head", "options"):
            with self.subTest(method=method):
                self.assertTrue(IsOwnerOrReadOnly().has_object_permission(self._request(method, other), None, obj))

    def test_writes_are_allowed_only_for_the_owner(self):
        owner, other = object(), object()
        obj = type("Obj", (), {"owner": owner})()
        for method in ("patch", "put", "delete"):
            with self.subTest(method=method):
                self.assertTrue(IsOwnerOrReadOnly().has_object_permission(self._request(method, owner), None, obj))
                self.assertFalse(IsOwnerOrReadOnly().has_object_permission(self._request(method, other), None, obj))
