"""Tests for POST /api/reports/ and the Report model and admin.

ClerkAuthentication is bypassed with force_authenticate.
"""
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.db import IntegrityError, transaction
from django.test import Client, TestCase
from rest_framework.test import APIRequestFactory, force_authenticate

from movie_csv.models import Collection, Comment, Log, Report, VideoEssay
from movie_csv.views.api import ReportCreate, ReportThrottle
from users.models import Block

User = get_user_model()


class ReportTestCase(TestCase):
    def setUp(self):
        cache.clear()  # the daily cap lives in the cache
        self.factory = APIRequestFactory()
        self.me = self._user("me")
        self.author = self._user("author")
        self.essay = VideoEssay.objects.create(title="An Essay", owner=self.author)
        self.log = Log.objects.create(
            owner=self.author, essay=self.essay, date="2026-09-20", rating=2, review_text="rude review"
        )
        self.comment = Comment.objects.create(user=self.author, log=self.log, text="rude comment")
        self.collection = Collection.objects.create(
            owner=self.author, name="Rude list", description="rude description"
        )

    def _user(self, name):
        user = User.objects.create(username=name)
        user.profile.display_username = name
        user.profile.save()
        return user

    def _post(self, data, user="me"):
        user = self.me if user == "me" else user
        request = self.factory.post("/api/reports/", data, format="json")
        if user is not None:
            force_authenticate(request, user=user)
        return ReportCreate.as_view()(request)

    def _body(self, target_type, target_id, reason="harassment", **extra):
        return {"target_type": target_type, "target_id": str(target_id), "reason": reason, **extra}


class CreateReportTests(ReportTestCase):
    def test_reports_a_log_with_a_snapshot(self):
        response = self._post(self._body("log", self.log.public_id, details="not ok"))
        self.assertEqual(response.status_code, 201)
        report = Report.objects.get()
        self.assertEqual(report.reporter, self.me)
        self.assertEqual(report.log, self.log)
        self.assertEqual(report.reason, "harassment")
        self.assertEqual(report.details, "not ok")
        self.assertEqual(report.status, "open")
        self.assertIn("rude review", report.snapshot)
        self.assertEqual(response.data["id"], report.id)

    def test_reports_a_comment(self):
        self.assertEqual(self._post(self._body("comment", self.comment.id)).status_code, 201)
        report = Report.objects.get()
        self.assertEqual(report.comment, self.comment)
        self.assertIn("rude comment", report.snapshot)

    def test_reports_a_user(self):
        self.assertEqual(self._post(self._body("user", self.author.id)).status_code, 201)
        report = Report.objects.get()
        self.assertEqual(report.reported_user, self.author)
        self.assertIn("author", report.snapshot)

    def test_reports_a_list(self):
        self.assertEqual(self._post(self._body("list", self.collection.public_id)).status_code, 201)
        report = Report.objects.get()
        self.assertEqual(report.collection, self.collection)
        self.assertIn("Rude list", report.snapshot)
        self.assertIn("rude description", report.snapshot)

    def test_duplicate_open_report_returns_the_existing_one(self):
        first = self._post(self._body("log", self.log.public_id))
        second = self._post(self._body("log", self.log.public_id, reason="spam"))
        self.assertEqual(second.status_code, 200)
        self.assertEqual(second.data["id"], first.data["id"])
        self.assertEqual(Report.objects.count(), 1)

    def test_a_resolved_report_does_not_block_a_new_one(self):
        self._post(self._body("log", self.log.public_id))
        Report.objects.update(status="resolved")
        self.assertEqual(self._post(self._body("log", self.log.public_id)).status_code, 201)
        self.assertEqual(Report.objects.count(), 2)

    def test_two_reporters_can_report_the_same_target(self):
        other = self._user("other")
        self._post(self._body("log", self.log.public_id))
        self.assertEqual(self._post(self._body("log", self.log.public_id), user=other).status_code, 201)

    def test_unauthenticated_is_rejected(self):
        response = self._post(self._body("log", self.log.public_id), user=None)
        self.assertIn(response.status_code, (401, 403))
        self.assertEqual(Report.objects.count(), 0)


class ReportValidationTests(ReportTestCase):
    def test_cannot_report_your_own_content(self):
        mine_log = Log.objects.create(owner=self.me, essay=self.essay, date="2026-09-20", rating=1)
        mine_comment = Comment.objects.create(user=self.me, log=self.log, text="mine")
        mine_list = Collection.objects.create(owner=self.me, name="Mine")
        for body in (
            self._body("log", mine_log.public_id),
            self._body("comment", mine_comment.id),
            self._body("list", mine_list.public_id),
            self._body("user", self.me.id),
        ):
            self.assertEqual(self._post(body).status_code, 400, body["target_type"])
        self.assertEqual(Report.objects.count(), 0)

    def test_unknown_targets_are_404(self):
        for body in (
            self._body("log", "00000000-0000-0000-0000-000000000000"),
            self._body("list", "00000000-0000-0000-0000-000000000000"),
            self._body("comment", 999999),
            self._body("user", 999999),
        ):
            self.assertEqual(self._post(body).status_code, 404, body["target_type"])

    def test_malformed_ids_are_400(self):
        self.assertEqual(self._post(self._body("log", "not-a-uuid")).status_code, 400)
        self.assertEqual(self._post(self._body("user", "abc")).status_code, 400)

    def test_bad_target_type_or_reason_or_missing_fields_are_400(self):
        self.assertEqual(self._post(self._body("essay", 1)).status_code, 400)
        self.assertEqual(self._post(self._body("log", self.log.public_id, reason="annoying")).status_code, 400)
        self.assertEqual(self._post({"target_type": "log", "reason": "spam"}).status_code, 400)
        self.assertEqual(self._post({}).status_code, 400)

    def test_details_are_limited_to_500_characters(self):
        response = self._post(self._body("log", self.log.public_id, details="x" * 501))
        self.assertEqual(response.status_code, 400)

    def test_content_hidden_by_a_block_is_404(self):
        Block.objects.create(blocker=self.author, blocked=self.me)
        for body in (
            self._body("log", self.log.public_id),
            self._body("comment", self.comment.id),
            self._body("list", self.collection.public_id),
            self._body("user", self.author.id),
        ):
            self.assertEqual(self._post(body).status_code, 404, body["target_type"])

    def test_someone_elses_watchlist_is_404(self):
        watchlist = Collection.watchlist_for(self.author)
        self.assertEqual(self._post(self._body("list", watchlist.public_id)).status_code, 404)


class ReportThrottleTests(ReportTestCase):
    def test_daily_cap_returns_429(self):
        with mock.patch.object(ReportThrottle, "rate", "2/day"):
            statuses = [
                self._post(self._body("log", self.log.public_id, reason=reason)).status_code
                for reason in ("spam", "hate", "other")
            ]
        self.assertEqual(statuses, [201, 200, 429])

    def test_the_cap_is_per_reporter(self):
        other = self._user("other")
        with mock.patch.object(ReportThrottle, "rate", "1/day"):
            self._post(self._body("log", self.log.public_id))
            self.assertEqual(
                self._post(self._body("log", self.log.public_id), user=other).status_code, 201
            )


class ReportModelTests(ReportTestCase):
    def test_a_report_cannot_have_two_targets(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            Report.objects.create(
                reporter=self.me, reason="spam", log=self.log, comment=self.comment, snapshot="x"
            )

    def test_a_report_survives_its_content_being_deleted(self):
        self._post(self._body("log", self.log.public_id))
        self.log.delete()
        report = Report.objects.get()
        self.assertIsNone(report.log)
        self.assertIn("rude review", report.snapshot)

    def test_a_report_survives_the_reporter_being_deleted(self):
        self._post(self._body("log", self.log.public_id))
        self.me.delete()
        report = Report.objects.get()
        self.assertIsNone(report.reporter)
        self.assertEqual(report.log, self.log)

    def test_a_report_survives_the_reported_user_being_deleted(self):
        self._post(self._body("user", self.author.id))
        self.author.delete()
        report = Report.objects.get()
        self.assertIsNone(report.reported_user)
        self.assertIn("author", report.snapshot)


class ReportAdminTests(ReportTestCase):
    def setUp(self):
        super().setUp()
        admin = User.objects.create_superuser("root", "root@example.com", "pw")
        self.client = Client()
        self.client.force_login(admin)

    def test_changelist_lists_unresolved_reports_first(self):
        old = Report.objects.create(reporter=self.me, reason="spam", log=self.log, snapshot="a", status="resolved")
        new = Report.objects.create(reporter=self.me, reason="spam", comment=self.comment, snapshot="b")
        response = self.client.get("/admin/movie_csv/report/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual([r.id for r in response.context["cl"].result_list], [new.id, old.id])

    def test_mark_resolved_action(self):
        report = Report.objects.create(reporter=self.me, reason="spam", log=self.log, snapshot="a")
        self.client.post(
            "/admin/movie_csv/report/",
            {"action": "mark_resolved", "_selected_action": [report.id]},
        )
        report.refresh_from_db()
        self.assertEqual(report.status, "resolved")
        self.assertIsNotNone(report.resolved_at)

    def test_delete_reported_content_action_removes_content_and_resolves(self):
        log_report = Report.objects.create(reporter=self.me, reason="spam", log=self.log, snapshot="a")
        list_report = Report.objects.create(
            reporter=self.me, reason="spam", collection=self.collection, snapshot="b"
        )
        self.client.post(
            "/admin/movie_csv/report/",
            {"action": "delete_reported_content", "_selected_action": [log_report.id, list_report.id]},
        )
        self.assertFalse(Log.objects.filter(pk=self.log.pk).exists())
        self.assertFalse(Collection.objects.filter(pk=self.collection.pk).exists())
        self.assertEqual(Report.objects.filter(status="resolved").count(), 2)

    def test_delete_reported_content_leaves_user_reports_alone(self):
        report = Report.objects.create(
            reporter=self.me, reason="spam", reported_user=self.author, snapshot="a"
        )
        self.client.post(
            "/admin/movie_csv/report/",
            {"action": "delete_reported_content", "_selected_action": [report.id]},
        )
        self.assertTrue(User.objects.filter(pk=self.author.pk).exists())
        report.refresh_from_db()
        self.assertEqual(report.status, "open")
