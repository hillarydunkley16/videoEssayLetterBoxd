"""Cache-Control rules on the videoessay-web static site in render.yaml.

Content assertions (no YAML parser in the venv, same as test_render_blueprint.py). The
real effect is confirmed on the deployed site with `curl -I` (TTSR plan, Task 6).
"""
import re
from pathlib import Path

from django.test import SimpleTestCase

REPO_ROOT = Path(__file__).resolve().parents[2]
RENDER_YAML = REPO_ROOT / "render.yaml"

IMMUTABLE = "public, max-age=31536000, immutable"
REVALIDATE = "public, max-age=0, must-revalidate"


class RenderStaticHeadersTests(SimpleTestCase):
    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        text = RENDER_YAML.read_text()
        web = text[text.index("name: videoessay-web"):]
        cls.rules = re.findall(
            r"- path:\s*(\S+)\s*\n\s*name:\s*(\S+)\s*\n\s*value:\s*(.+)", web
        )

    def cache_control(self, path):
        return [v.strip() for p, n, v in self.rules if p == path and n == "Cache-Control"]

    def test_headers_block_belongs_to_the_static_site(self):
        text = RENDER_YAML.read_text()
        self.assertGreater(text.index("headers:"), text.index("name: videoessay-web"))

    def test_hashed_expo_assets_are_cached_immutably_for_a_year(self):
        # Filenames under /_expo/static carry a content hash, so they never change.
        self.assertEqual(self.cache_control("/_expo/static/*"), [IMMUTABLE])

    def test_self_hosted_fonts_are_cached_immutably_for_a_year(self):
        # Safe only because font files are versioned (-v1); bump the suffix to change one.
        self.assertEqual(self.cache_control("/fonts/*"), [IMMUTABLE])

    def test_html_is_revalidated_so_deploys_show_up(self):
        self.assertEqual(self.cache_control("/index.html"), [REVALIDATE])

    def test_no_catch_all_rule_overrides_the_specific_ones(self):
        self.assertNotIn("/*", [p for p, n, v in self.rules if n == "Cache-Control"])
