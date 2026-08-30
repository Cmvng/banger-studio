import importlib.util
import base64
import contextlib
import http.cookiejar
import json
import pathlib
import tempfile
import threading
import unittest
import urllib.error
import urllib.request
from unittest import mock
from http.server import ThreadingHTTPServer


PROJECT_ROOT = pathlib.Path(__file__).resolve().parents[1]
MODULE_PATH = PROJECT_ROOT / ("app-v3.py" if (PROJECT_ROOT / "app-v3.py").exists() else "app.py")
SPEC = importlib.util.spec_from_file_location("banger_app_v3", MODULE_PATH)
app = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(app)


class WriterEvidenceTests(unittest.TestCase):
    @contextlib.contextmanager
    def server(self):
        server = ThreadingHTTPServer(("127.0.0.1", 0), app.H)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        try:
            yield "http://127.0.0.1:%d" % server.server_port
        finally:
            server.shutdown()
            server.server_close()

    @staticmethod
    def post_json(opener, url, payload):
        request = urllib.request.Request(
            url,
            data=json.dumps(payload).encode(),
            headers={"Content-Type": "application/json"},
        )
        with opener.open(request) as response:
            return json.loads(response.read()), response.headers

    def test_page_extraction_accepts_reversed_meta_attributes_and_relative_image(self):
        source = "https://project.example/research/launch"
        page = """
        <html><head>
          <title>Fallback title</title>
          <meta content="Project launch report" property="og:title">
          <meta content="The network launched mainnet on August 12 with 18 validators." name="description">
          <meta content="/media/launch.png" property="og:image">
        </head><body><article><p>The team released the public network after a six-month testnet.</p></article></body></html>
        """
        with mock.patch.object(app, "_safe_public_url", return_value=True), mock.patch.object(app, "fetch", return_value=page):
            result = app._extract_link_source(source)
        self.assertEqual(result["title"], "Project launch report")
        self.assertIn("18 validators", result["excerpts"][0])
        self.assertEqual(result["images"], ["https://project.example/media/launch.png"])

    def test_exact_x_post_fixture_becomes_evidence(self):
        tweet = json.dumps({
            "text": "Mainnet is live today with 18 validators.",
            "user": {"screen_name": "project", "name": "Project"},
            "mediaDetails": [{"media_url_https": "https://cdn.example/launch.jpg"}],
        })

        def fake_fetch(url, binary=False, timeout=10):
            if "tweet-result" in url:
                return tweet
            return None

        with tempfile.TemporaryDirectory() as assets, mock.patch.object(app, "_safe_public_url", return_value=True), mock.patch.object(app, "fetch", side_effect=fake_fetch):
            brief = app.build_brief(app.gather("Project", "https://x.com/project/status/123456789", assets))
        self.assertTrue(brief["writing_ready"])
        self.assertEqual(brief["source_kind"], "exact X post")
        self.assertIn("18 validators", brief["source_excerpt"][0])

    def test_mobile_x_exact_post_uses_same_evidence_path(self):
        tweet = json.dumps({"text": "Testnet launched with 24 validators.", "user": {"screen_name": "project"}})

        def fake_fetch(url, binary=False, timeout=10):
            return tweet if "tweet-result" in url else None

        with mock.patch.object(app, "_safe_public_url", return_value=True), mock.patch.object(app, "fetch", side_effect=fake_fetch):
            result = app._extract_link_source("https://mobile.x.com/project/status/987654321")
        self.assertEqual(result["kind"], "exact X post")
        self.assertEqual(result["status"], "fetched")
        self.assertIn("24 validators", result["excerpts"][0])

    def test_private_redirect_target_is_rejected_before_following(self):
        handler = app._SafeRedirectHandler()
        request = urllib.request.Request("https://public.example/article")
        with mock.patch.object(app, "_safe_public_url", side_effect=lambda url: "127.0.0.1" not in url):
            with self.assertRaises(urllib.error.HTTPError) as caught:
                handler.redirect_request(request, None, 302, "Found", {}, "http://127.0.0.1/private")
        self.assertEqual(caught.exception.code, 403)

    def test_canonical_article_is_recorded_and_original_page_is_not_fetched_twice(self):
        source = "https://project.example/go/launch"
        canonical = "https://project.example/research/launch"
        page = (
            '<link rel="canonical" href="/research/launch">'
            '<script type="application/ld+json">'
            '{"@type":"NewsArticle","articleBody":"Project launched mainnet with 18 validators on August 12."}'
            '</script>'
        )
        calls = []

        def fake_fetch(url, binary=False, timeout=10):
            calls.append(url)
            return page if url == source else None

        with tempfile.TemporaryDirectory() as assets, mock.patch.object(app, "_safe_public_url", return_value=True), mock.patch.object(app, "fetch", side_effect=fake_fetch):
            dossier = app.gather("Project", source, assets)
        self.assertEqual(dossier["root"], canonical)
        self.assertEqual(calls.count(source), 1)
        self.assertTrue(dossier["writing_ready"])
        self.assertTrue(any(item["kind"] == "canonical webpage" for item in dossier["sources"]))

    def test_jsonld_article_works_when_meta_is_weak(self):
        page = """
        <html><head><title>Home</title><meta name="description" content="Welcome"></head><body>
        <script type="application/ld+json">
        {"@graph":[{"@type":"Organization","description":"Official website"},
        {"@type":"Article","articleBody":"The protocol launched mainnet on August 12 with 18 independent validators."}]}
        </script></body></html>
        """
        with mock.patch.object(app, "_safe_public_url", return_value=True), mock.patch.object(app, "fetch", return_value=page):
            result = app._extract_link_source("https://project.example/article")
        self.assertEqual(len(result["excerpts"]), 1)
        self.assertIn("18 independent validators", result["excerpts"][0])

    def test_antibot_page_is_not_evidence(self):
        challenge = '<html><title>Just a moment...</title><div class="cf-chl-xyz">Verify you are human to continue</div></html>'
        calls = []

        def fake_fetch(url, binary=False, timeout=10):
            calls.append(url)
            return challenge if "project.example" in url else None

        with tempfile.TemporaryDirectory() as assets, mock.patch.object(app, "_safe_public_url", return_value=True), mock.patch.object(app, "fetch", side_effect=fake_fetch):
            brief = app.build_brief(app.gather("Project", "https://project.example/article", assets))
        self.assertFalse(brief["writing_ready"])
        self.assertEqual(brief["research_status"], "blocked")
        self.assertEqual(brief["source_excerpt"], [])
        self.assertEqual(calls.count("https://project.example/article"), 1)

    def test_fetch_failure_is_reported_as_unreadable_without_evidence(self):
        with tempfile.TemporaryDirectory() as assets, mock.patch.object(app, "_safe_public_url", return_value=True), mock.patch.object(app, "fetch", return_value=None):
            brief = app.build_brief(app.gather("Project", "https://project.example/article", assets))
        self.assertFalse(brief["writing_ready"])
        self.assertEqual(brief["research_status"], "unreadable")
        self.assertEqual(brief["source_errors"][0]["status"], "unreadable")

    def test_conflicting_x_identity_rejects_coin_profile_market_data(self):
        tweet = json.dumps({"text": "Mainnet launched with 18 validators.", "user": {"screen_name": "alpha"}})
        search = json.dumps({"coins": [{"id": "project", "name": "Project", "symbol": "PRJ"}]})
        profile = json.dumps({
            "links": {"homepage": ["https://wrong.example"], "twitter_screen_name": "beta"},
            "description": {"en": "Wrong token profile"},
            "market_data": {"current_price": {"usd": 99}, "market_cap": {"usd": 1000000}},
        })

        def fake_fetch(url, binary=False, timeout=10):
            if "tweet-result" in url:
                return tweet
            if "/search?query=" in url:
                return search
            if "/api/v3/coins/project?" in url:
                return profile
            return None

        with tempfile.TemporaryDirectory() as assets, mock.patch.object(app, "_safe_public_url", return_value=True), mock.patch.object(app, "fetch", side_effect=fake_fetch):
            brief = app.build_brief(app.gather("Project", "https://x.com/alpha/status/77", assets))
        self.assertTrue(brief["writing_ready"])
        self.assertNotIn("price usd", brief["live_numbers"])
        self.assertFalse(any(item["kind"] == "CoinGecko" for item in brief["sources"]))

    def test_multiple_urls_are_deduplicated_and_aggregated(self):
        raw = "https://project.example/article\nhttps://mobile.x.com/project/status/77\nhttps://project.example/article"
        self.assertEqual(app._source_urls(raw), [
            "https://project.example/article", "https://mobile.x.com/project/status/77"
        ])
        tweet = json.dumps({"text": "Mainnet launched with 18 validators.", "user": {"screen_name": "project"}})
        article = "<article><p>The public network launched after a six-month testnet with independent operators.</p></article>"

        def fake_fetch(url, binary=False, timeout=10):
            if "tweet-result" in url:
                return tweet
            if url == "https://project.example/article":
                return article
            return None

        with tempfile.TemporaryDirectory() as assets, mock.patch.object(app, "_safe_public_url", return_value=True), mock.patch.object(app, "fetch", side_effect=fake_fetch):
            brief = app.build_brief(app.gather("Project", raw, assets))
        self.assertEqual(brief["source_kind"], "multiple sources")
        self.assertEqual(len(brief["source_urls"]), 2)
        self.assertGreaterEqual(len(brief["source_excerpt"]), 2)

    def test_generic_title_and_homepage_fluff_do_not_unlock_writer(self):
        page = "<html><head><title>Project</title><meta content='Welcome' name='description'></head><body>Home</body></html>"

        def fake_fetch(url, binary=False, timeout=10):
            return page if "project.example" in url else None

        with tempfile.TemporaryDirectory() as assets, mock.patch.object(app, "_safe_public_url", return_value=True), mock.patch.object(app, "fetch", side_effect=fake_fetch):
            brief = app.build_brief(app.gather("Project", "https://project.example", assets))
        self.assertFalse(brief["writing_ready"])
        self.assertEqual(brief["verified_facts"], [])
        self.assertEqual(brief["source_excerpt"], [])

    def test_mirror_chatter_alone_is_context_not_verified_evidence(self):
        mirror = '<div class="tweet-content">Project might launch something soon according to rumors</div>'

        def fake_fetch(url, binary=False, timeout=10):
            return mirror if "/search?q=" in url else None

        with tempfile.TemporaryDirectory() as assets, mock.patch.object(app, "_safe_public_url", return_value=True), mock.patch.object(app, "fetch", side_effect=fake_fetch):
            brief = app.build_brief(app.gather("Project", "", assets))
        self.assertFalse(brief["writing_ready"])
        self.assertTrue(brief["x_pulse"])
        self.assertEqual(brief["x_pulse"][0]["src"], "mirror")

    def test_x_status_id_is_not_mistaken_for_a_fact(self):
        topic = "Project: @project\nOfficial source: https://x.com/project/status/123456789\nRequested angle: general project overview"
        blocker = app._compose_preflight(topic, {"writing_ready": False}, [])
        self.assertIn("did not spend a writing call", blocker)
        self.assertFalse(app._topic_has_concrete_material(topic))

    def test_url_only_and_mirror_only_briefs_cannot_unlock_paid_writer(self):
        url_only = {
            "writing_ready": True,
            "sources": [{"kind": "provided webpage", "url": "https://project.example"}],
            "source_url": "https://project.example",
        }
        mirror_only = {
            "writing_ready": True,
            "x_pulse": [{"src": "mirror", "text": "Project might launch a token according to rumors."}],
        }
        self.assertFalse(app._brief_has_evidence(url_only))
        self.assertFalse(app._brief_has_evidence(mirror_only))
        self.assertTrue(app._compose_preflight("https://project.example", url_only, []))

    def test_stale_project_brief_does_not_authorize_new_project(self):
        brief = {
            "project": "Alpha",
            "source_url": "https://alpha.example/article",
            "source_urls": ["https://alpha.example/article"],
            "writing_ready": True,
            "source_excerpt": ["Alpha launched mainnet with 18 validators."],
        }
        topic = "Project: Beta\nOfficial source: https://beta.example/article\nRequested angle: general project overview"
        self.assertFalse(app._brief_matches_topic(brief, topic))
        self.assertTrue(app._compose_preflight(topic, None, []))

    def test_image_magic_validation_distinguishes_real_screenshot_bytes(self):
        png = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")
        self.assertTrue(app._valid_image_bytes("image/png", png))
        self.assertFalse(app._valid_image_bytes("image/jpeg", png))
        self.assertFalse(app._valid_image_bytes("image/png", b"not really an image"))

    def test_compose_invalid_screenshot_blocks_and_valid_screenshot_reaches_writer(self):
        png_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
        calls = []

        def fake_write(topic, ctype, n=3, brief=None, voice=None, images=None):
            calls.append(images)
            return {"versions": [{"draft": "ok"}]}

        with tempfile.TemporaryDirectory() as briefs, self.server() as base, \
                mock.patch.object(app, "BRIEF_DIR", briefs), mock.patch.object(app, "ACCESS_KEY", ""), \
                mock.patch.object(app, "write_styled", side_effect=fake_write):
            opener = urllib.request.build_opener()
            invalid, _ = self.post_json(opener, base + "/compose", {
                "topic": "https://project.example/article", "images": ["data:image/png;base64,bm90LWFuLWltYWdl"]
            })
            valid, _ = self.post_json(opener, base + "/compose", {
                "topic": "https://project.example/article", "images": ["data:image/png;base64," + png_b64]
            })
        self.assertEqual(invalid["error"], "need_facts")
        self.assertEqual(len(calls), 1)
        self.assertEqual(len(calls[0]), 1)
        self.assertTrue(valid["versions"])

    def test_anonymous_cookie_session_persists_and_duplicate_gather_is_cached(self):
        calls = []

        def fake_gather(project, sources, assets):
            calls.append((project, sources))
            return object()

        def fake_build(_):
            return {
                "project": "Project", "official_source": "https://project.example/article",
                "source_url": "https://project.example/article", "source_urls": ["https://project.example/article"],
                "source_kind": "provided webpage", "source_status": "fetched", "source_errors": [],
                "source_excerpt": ["Project launched mainnet with 18 validators."], "research_status": "ready",
                "research_timed_out": False,
                "research_key": app._research_key("Project", "https://project.example/article"),
                "researched_at_epoch": int(app.time.time()), "writing_ready": True, "sources": [], "one_liner": "",
                "verified_facts": [], "live_numbers": {}, "news_feed": [], "pages_read": [], "x_pulse": [],
                "assets_for_design": [],
            }

        jar = http.cookiejar.CookieJar()
        opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
        with tempfile.TemporaryDirectory() as briefs, self.server() as base, \
                mock.patch.object(app, "BRIEF_DIR", briefs), mock.patch.object(app, "ACCESS_KEY", ""), \
                mock.patch.object(app, "gather", side_effect=fake_gather), mock.patch.object(app, "build_brief", side_effect=fake_build), \
                mock.patch.object(app, "RESEARCH_CACHE_TTL_SECONDS", 300):
            first, first_headers = self.post_json(opener, base + "/gather", {
                "proj": "Project", "root": "https://project.example/article"
            })
            second, _ = self.post_json(opener, base + "/gather", {
                "proj": "Project", "root": "https://project.example/article"
            })
        self.assertIn("banger_session=", first_headers.get("Set-Cookie", ""))
        self.assertFalse(first["cached"])
        self.assertTrue(second["cached"])
        self.assertEqual(len(calls), 1)

    def test_research_deadline_stops_additional_fetches_and_returns_no_evidence(self):
        calls = []

        def fake_fetch(url, binary=False, timeout=10):
            calls.append(url)
            return None

        with tempfile.TemporaryDirectory() as assets, mock.patch.object(app, "RESEARCH_DEADLINE_SECONDS", 0), \
                mock.patch.object(app, "_safe_public_url", return_value=True), mock.patch.object(app, "fetch", side_effect=fake_fetch):
            brief = app.build_brief(app.gather("Project", "https://project.example/article", assets))
        self.assertTrue(brief["research_timed_out"])
        self.assertEqual(brief["research_status"], "timed_out")
        self.assertFalse(brief["writing_ready"])
        self.assertEqual(calls, [])

    def test_real_user_fact_or_ready_brief_unlocks_preflight(self):
        fact_topic = "Project: Project\nOfficial source: https://project.example\nRequested angle: Project launched mainnet on August 12 with 18 validators."
        self.assertEqual(app._compose_preflight(fact_topic, None, []), "")
        ready = {"writing_ready": True, "source_excerpt": ["Project launched mainnet on August 12 with 18 validators."]}
        self.assertEqual(app._compose_preflight("https://project.example", ready, []), "")

    def test_single_labeled_live_number_is_usable_evidence(self):
        brief = {"writing_ready": True, "live_numbers": {"TVL": "$18,000,000"}}
        self.assertTrue(app._brief_has_evidence(brief))
        self.assertEqual(app._compose_preflight("https://project.example", brief, []), "")

    def test_writer_returns_need_facts_before_api_call(self):
        topic = "Project: @project\nOfficial source: https://x.com/project/status/123456789\nRequested angle: general project overview"
        with mock.patch.object(app, "API_KEY", "test"), mock.patch.object(app, "_call_api", side_effect=AssertionError("paid API must not run")):
            result = app.write_styled(topic, "deepdive", brief={"writing_ready": False})
        self.assertEqual(result["error"], "need_facts")

    def test_gather_payload_explains_each_failure_state(self):
        cases = {
            "blocked": "blocked automated reading",
            "timed_out": "safety time limit",
            "unreadable": "could not read enough evidence",
            "failed": "could not read enough evidence",
            "partial": "not enough verifiable material",
        }
        for status, phrase in cases.items():
            with self.subTest(status=status):
                payload = app._gather_payload({"writing_ready": False, "research_status": status})
                self.assertEqual(payload["error"], "need_facts")
                self.assertIn(phrase, payload["message"])
        ready = app._gather_payload({"writing_ready": True, "research_status": "ready"}, cached=True)
        self.assertEqual(ready, {"brief": {"writing_ready": True, "research_status": "ready"}, "cached": True})


if __name__ == "__main__":
    unittest.main()
