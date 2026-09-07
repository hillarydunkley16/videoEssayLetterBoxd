"""Guards on the repo-root render.yaml Blueprint.

No YAML parser in the venv, so these are content assertions — the authoritative
validation is Render's Blueprint parser at deploy time (Task 11).
"""
from pathlib import Path

from django.test import SimpleTestCase

REPO_ROOT = Path(__file__).resolve().parents[2]
RENDER_YAML = REPO_ROOT / "render.yaml"


class RenderBlueprintTests(SimpleTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.text = RENDER_YAML.read_text() if RENDER_YAML.exists() else ""

    def test_blueprint_file_exists_at_repo_root(self):
        self.assertTrue(RENDER_YAML.exists())

    def test_declares_a_free_postgres_database(self):
        self.assertIn("databases:", self.text)
        self.assertIn("plan: free", self.text)

    def test_has_a_python_web_service_and_a_static_site(self):
        self.assertIn("runtime: python", self.text)
        self.assertIn("runtime: static", self.text)
        self.assertEqual(self.text.count("type: web"), 2)

    def test_backend_build_migrate_and_start_commands(self):
        self.assertIn("requirements.txt", self.text)
        self.assertIn("collectstatic --noinput", self.text)
        self.assertIn("manage.py migrate", self.text)
        self.assertIn("gunicorn config.wsgi:application", self.text)
        self.assertIn("0.0.0.0:$PORT", self.text)

    def test_python_version_pinned_to_313(self):
        self.assertIn("key: PYTHON_VERSION", self.text)
        self.assertRegex(self.text, r'value:\s*"3\.13\.\d+"')

    def test_migrate_and_collectstatic_run_at_start_not_build(self):
        # settings.py raises on a missing CLERK_ISSUER; keep DB/Clerk-touching
        # commands out of buildCommand where sync:false vars may be absent.
        build_line = next(
            (ln for ln in self.text.splitlines() if ln.strip().startswith("buildCommand:")),
            "",
        )
        self.assertIn("pip install", build_line)
        self.assertNotIn("migrate", build_line)
        self.assertNotIn("collectstatic", build_line)

    def test_static_site_publishes_a_dir_with_spa_rewrite(self):
        self.assertIn("staticPublishPath:", self.text)
        self.assertIn("npx expo export --platform web", self.text)
        self.assertIn("destination: /index.html", self.text)
        self.assertIn("type: rewrite", self.text)

    def test_database_url_wired_from_the_managed_db(self):
        self.assertIn("fromDatabase:", self.text)
        self.assertIn("property: connectionString", self.text)

    def test_secret_key_is_generated_and_debug_is_off(self):
        self.assertIn("key: DJANGO_SECRET_KEY", self.text)
        self.assertIn("generateValue: true", self.text)
        self.assertIn("key: DJANGO_DEBUG", self.text)
        self.assertIn('value: "false"', self.text)

    def test_operator_supplied_secrets_are_marked_sync_false(self):
        for key in ("CLERK_ISSUER", "SERPAPI_KEY",
                    "EXPO_PUBLIC_API_BASE_URL", "EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY"):
            self.assertIn(f"key: {key}", self.text)
        self.assertIn("sync: false", self.text)

    def test_no_real_secret_values_committed(self):
        self.assertNotIn("sk_live", self.text)
        self.assertNotIn("pk_live", self.text)
        self.assertNotIn("splendid-sunbird-55", self.text)
