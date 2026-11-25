"""Tests for the backfill_display_usernames management command.

Clerk's Backend API is mocked; these cover the command's own logic (paging, matching Clerk
ids to Django users, idempotency, never blanking a stored name, --dry-run, the secret key).
"""
from io import StringIO
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.management import CommandError, call_command
from django.test import TestCase

from users.management.commands import backfill_display_usernames as command

User = get_user_model()


def _clerk_user(clerk_id, username):
    return {"id": clerk_id, "username": username}


def _page(users):
    return mock.Mock(status_code=200, json=lambda: users)


class BackfillDisplayUsernamesTests(TestCase):
    def setUp(self):
        self.a = User.objects.create(username="user_a")
        self.b = User.objects.create(username="user_b")
        patcher = mock.patch.dict("os.environ", {"CLERK_SECRET_KEY": "sk_test_secret"})
        patcher.start()
        self.addCleanup(patcher.stop)

    def _run(self, *args, pages=None):
        pages = pages if pages is not None else [[_clerk_user("user_a", "alice"), _clerk_user("user_b", "bob")]]
        out = StringIO()
        with mock.patch.object(command.requests, "get", side_effect=[_page(p) for p in pages]) as mock_get:
            call_command("backfill_display_usernames", *args, stdout=out)
        return out.getvalue(), mock_get

    def _name(self, user):
        user.profile.refresh_from_db()
        return user.profile.display_username

    def test_sets_display_usernames_by_clerk_id(self):
        self._run()
        self.assertEqual((self._name(self.a), self._name(self.b)), ("alice", "bob"))

    def test_django_username_is_never_changed(self):
        self._run()
        self.a.refresh_from_db()
        self.assertEqual(self.a.username, "user_a")

    def test_is_idempotent(self):
        self._run()
        with mock.patch("users.models.Profile.save") as mock_save:
            output, _ = self._run()
        mock_save.assert_not_called()
        self.assertIn("0 updated", output)

    def test_clerk_users_missing_locally_are_skipped_not_created(self):
        self._run(pages=[[_clerk_user("user_ghost", "ghost"), _clerk_user("user_a", "alice")]])
        self.assertFalse(User.objects.filter(username="user_ghost").exists())
        self.assertEqual(self._name(self.a), "alice")

    def test_null_or_empty_clerk_username_never_blanks_a_stored_name(self):
        self.a.profile.display_username = "alice"
        self.a.profile.save()
        self._run(pages=[[_clerk_user("user_a", None), _clerk_user("user_b", "")]])
        self.assertEqual(self._name(self.a), "alice")
        self.assertIsNone(self._name(self.b))

    def test_changed_clerk_username_updates_the_stored_name(self):
        self.a.profile.display_username = "old"
        self.a.profile.save()
        self._run()
        self.assertEqual(self._name(self.a), "alice")

    def test_user_without_a_profile_row_gets_one(self):
        self.a.profile.delete()
        self._run()
        self.assertEqual(User.objects.get(pk=self.a.pk).profile.display_username, "alice")

    def test_dry_run_writes_nothing_but_reports(self):
        output, _ = self._run("--dry-run")
        self.assertIsNone(self._name(self.a))
        self.assertIn("dry run", output.lower())
        self.assertIn("2 updated", output)  # "would update" count still reported

    def test_pages_until_a_short_page(self):
        with mock.patch.object(command, "PAGE_SIZE", 1):
            _, mock_get = self._run(pages=[
                [_clerk_user("user_a", "alice")],
                [_clerk_user("user_b", "bob")],
                [],
            ])
        self.assertEqual(mock_get.call_count, 3)
        offsets = [call.kwargs["params"]["offset"] for call in mock_get.call_args_list]
        self.assertEqual(offsets, [0, 1, 2])
        self.assertEqual((self._name(self.a), self._name(self.b)), ("alice", "bob"))

    def test_sends_the_secret_key_as_a_bearer_token_and_never_prints_it(self):
        output, mock_get = self._run()
        self.assertEqual(mock_get.call_args.kwargs["headers"]["Authorization"], "Bearer sk_test_secret")
        self.assertNotIn("sk_test_secret", output)

    def test_missing_secret_key_is_a_clear_error(self):
        with mock.patch.dict("os.environ", {}, clear=True):
            with self.assertRaisesRegex(CommandError, "CLERK_SECRET_KEY"):
                call_command("backfill_display_usernames", stdout=StringIO())

    def test_clerk_api_error_aborts_without_writing(self):
        failing = mock.Mock(status_code=401, json=lambda: {"errors": []})
        with mock.patch.object(command.requests, "get", return_value=failing):
            with self.assertRaisesRegex(CommandError, "401"):
                call_command("backfill_display_usernames", stdout=StringIO())
        self.assertIsNone(self._name(self.a))
