"""Closed-beta smoke tests: API endpoints are wired + auth is enforced where
configured, and the deploy artifacts (.env.example, runtime.txt) are honest.
"""
import re
from pathlib import Path

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIClient

from movie_csv.models import Collection, Log, VideoEssay

User = get_user_model()
BACKEND_DIR = Path(__file__).resolve().parent.parent


class ProtectedEndpointsRejectAnonymousTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_log_list_requires_auth(self):
        self.assertIn(self.client.get("/api/logList/").status_code, (401, 403))

    def test_user_logs_requires_auth(self):
        self.assertIn(self.client.get("/api/userLogs/").status_code, (401, 403))

    def test_collections_by_user_requires_auth(self):
        self.assertIn(self.client.get("/api/collections/user/").status_code, (401, 403))


class AuthenticatedRequestsSucceedTests(TestCase):
    def setUp(self):
        self.user = User.objects.create(username="clerk_smoke_user")
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def test_log_list_returns_200_for_authenticated_user(self):
        essay = VideoEssay.objects.create(title="Essay", owner=self.user)
        Log.objects.create(
            essay=essay, owner=self.user, date="2026-01-01", review_text="ok", rating=4
        )
        response = self.client.get("/api/logList/")
        self.assertEqual(response.status_code, 200)

    def test_user_logs_returns_200_for_authenticated_user(self):
        self.assertEqual(self.client.get("/api/userLogs/").status_code, 200)


class PublicEndpointsServeAnonymousTests(TestCase):
    """VideoEssays and CollectionList are intentionally AllowAny today — these
    lock in that current contract. See the note in tasks/todo.md Task 7/14 about
    revisiting during the security pass."""

    def setUp(self):
        self.client = APIClient()

    def test_video_essays_list_is_public(self):
        response = self.client.get("/api/VideoEssays/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("results", response.json())

    def test_collections_list_is_public(self):
        self.assertEqual(self.client.get("/api/collections/").status_code, 200)


class AdminReachableTests(TestCase):
    def test_admin_login_page_renders(self):
        self.assertEqual(self.client.get("/admin/login/").status_code, 200)

    def test_legacy_web_root_is_gone(self):
        self.assertEqual(self.client.get("/").status_code, 404)


class EnvExampleTests(SimpleTestCase):
    ENV_EXAMPLE = BACKEND_DIR / ".env.example"
    SOURCE_FILES = [
        BACKEND_DIR / "config" / "settings.py",
        BACKEND_DIR / "movie_csv" / "authentication.py",
        BACKEND_DIR / "movie_csv" / "views" / "api.py",
        BACKEND_DIR / "movie_csv" / "services" / "youtube_search.py",
    ]

    def test_env_example_exists(self):
        self.assertTrue(self.ENV_EXAMPLE.exists())

    def test_every_documented_var_is_read_somewhere_in_source(self):
        names = re.findall(r"^([A-Z][A-Z0-9_]+)=", self.ENV_EXAMPLE.read_text(), re.M)
        self.assertTrue(names, "no vars found in .env.example")
        blob = "\n".join(p.read_text() for p in self.SOURCE_FILES if p.exists())
        missing = [n for n in names if n not in blob]
        self.assertEqual(missing, [], f"documented but never read: {missing}")

    def test_env_example_has_no_real_secret_values(self):
        for line in self.ENV_EXAMPLE.read_text().splitlines():
            if line.startswith("SERPAPI_KEY=") or line.startswith("DJANGO_SECRET_KEY="):
                value = line.split("=", 1)[1].strip()
                self.assertIn(value, ("", '""', "changeme", "your-key-here"), line)


class RuntimeTxtTests(SimpleTestCase):
    def test_runtime_txt_pins_python_313(self):
        runtime = (BACKEND_DIR / "runtime.txt")
        self.assertTrue(runtime.exists())
        self.assertRegex(runtime.read_text().strip(), r"^python-3\.13\.\d+$")
