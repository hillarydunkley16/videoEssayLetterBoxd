"""Backfill Profile.display_username from Clerk for users who haven't signed in since the
session token started carrying a `username` claim (ClerkAuthentication only fills it in on
the user's next request).

Reads CLERK_SECRET_KEY from the environment; set it only for the run (e.g. in the Render
shell), not in render.yaml. Safe to re-run: it only writes names that changed, never blanks a
stored name, and never creates users.

    python manage.py backfill_display_usernames --dry-run
    python manage.py backfill_display_usernames
"""
import os

import requests
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand, CommandError

from users.models import Profile

User = get_user_model()

DEFAULT_CLERK_API_URL = "https://api.clerk.com/v1"
PAGE_SIZE = 500  # Clerk's maximum for GET /users


class Command(BaseCommand):
    help = "Copy Clerk usernames onto Profile.display_username for existing users."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run", action="store_true", help="Report what would change without writing."
        )

    def handle(self, *args, dry_run=False, **options):
        secret_key = os.environ.get("CLERK_SECRET_KEY")
        if not secret_key:
            raise CommandError("CLERK_SECRET_KEY is not set.")

        counts = {"updated": 0, "unchanged": 0, "no_username": 0, "missing": 0}
        for clerk_users in self._clerk_pages(secret_key):
            self._apply(clerk_users, counts, dry_run)

        self.stdout.write(
            f"{'Dry run: ' if dry_run else ''}{counts['updated']} updated, "
            f"{counts['unchanged']} unchanged, "
            f"{counts['no_username']} without a Clerk username, "
            f"{counts['missing']} not in this database."
        )

    def _clerk_pages(self, secret_key):
        base_url = (os.environ.get("CLERK_API_URL") or DEFAULT_CLERK_API_URL).rstrip("/")
        headers = {"Authorization": f"Bearer {secret_key}"}
        offset = 0
        while True:
            response = requests.get(
                f"{base_url}/users",
                headers=headers,
                # Oldest first so users signing up mid-run can't shift earlier pages.
                params={"limit": PAGE_SIZE, "offset": offset, "order_by": "+created_at"},
                timeout=30,
            )
            if response.status_code != 200:
                raise CommandError(f"Clerk API returned {response.status_code}.")
            payload = response.json()
            page = payload["data"] if isinstance(payload, dict) else payload
            yield page
            if len(page) < PAGE_SIZE:
                return
            offset += PAGE_SIZE

    def _apply(self, clerk_users, counts, dry_run):
        # Django's User.username is the Clerk id (see ClerkAuthentication).
        local_users = {u.username: u for u in User.objects.filter(username__in=[c["id"] for c in clerk_users])}
        for clerk_user in clerk_users:
            username = clerk_user.get("username")
            if not username:
                counts["no_username"] += 1  # never blank a stored name
                continue
            user = local_users.get(clerk_user["id"])
            if user is None:
                counts["missing"] += 1
                continue
            profile = Profile.objects.filter(user=user).first()
            if profile is not None and profile.display_username == username:
                counts["unchanged"] += 1
                continue
            counts["updated"] += 1
            if dry_run:
                continue
            if profile is None:
                profile = Profile(user=user)
            profile.display_username = username
            profile.save()
