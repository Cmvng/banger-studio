import gzip
import json
import os
import threading
import unittest
import urllib.error
import urllib.request
from html.parser import HTMLParser
from http.server import ThreadingHTTPServer

import app


class AccessibilityParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = []
        self.images_without_alt = []
        self.buttons = []
        self._button = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            self.ids.append(attrs["id"])
        if tag == "img" and "alt" not in attrs:
            self.images_without_alt.append(attrs)
        if tag == "button":
            self._button = {"attrs": attrs, "text": ""}

    def handle_data(self, data):
        if self._button is not None:
            self._button["text"] += data

    def handle_endtag(self, tag):
        if tag == "button" and self._button is not None:
            self.buttons.append(self._button)
            self._button = None


class BangerStudioTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.server = ThreadingHTTPServer(("127.0.0.1", 0), app.H)
        cls.thread = threading.Thread(target=cls.server.serve_forever, daemon=True)
        cls.thread.start()
        cls.base = "http://127.0.0.1:%d" % cls.server.server_port

    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown()
        cls.server.server_close()

    def test_ssrf_guard_rejects_private_targets(self):
        for url in (
            "http://127.0.0.1",
            "http://localhost",
            "http://169.254.169.254/latest/meta-data",
            "file:///etc/passwd",
        ):
            self.assertFalse(app._safe_public_url(url), url)

    def test_session_ids_are_sanitized(self):
        self.assertEqual(app._session_id({"session": "../hello<script>"}), "helloscript")
        self.assertLessEqual(len(app._session_id({"session": "a" * 500})), 80)

    def test_health_is_json_and_hardened(self):
        with urllib.request.urlopen(self.base + "/health") as response:
            data = json.loads(response.read())
            self.assertEqual(data["status"], "ok")
            self.assertEqual(response.headers["X-Content-Type-Options"], "nosniff")
            self.assertEqual(response.headers["X-Frame-Options"], "DENY")

    def test_app_is_small_and_gzip_compressed(self):
        request = urllib.request.Request(self.base + "/app", headers={"Accept-Encoding": "gzip"})
        with urllib.request.urlopen(request) as response:
            body = response.read()
            self.assertEqual(response.headers["Content-Encoding"], "gzip")
            decoded = gzip.decompress(body).decode()
            self.assertIn("Turn raw context into", decoded)
            self.assertLess(len(decoded.encode()), 250_000)

    def test_post_access_key_can_protect_generation(self):
        original = app.ACCESS_KEY
        app.ACCESS_KEY = "test-secret"
        try:
            body = json.dumps({"topic": "facts"}).encode()
            request = urllib.request.Request(
                self.base + "/compose",
                data=body,
                headers={"Content-Type": "application/json"},
            )
            with self.assertRaises(urllib.error.HTTPError) as caught:
                urllib.request.urlopen(request)
            self.assertEqual(caught.exception.code, 401)
        finally:
            app.ACCESS_KEY = original

    def test_markup_has_unique_ids_and_accessible_buttons(self):
        with open(os.path.join(app.ROOT, "banger-studio-app.html"), encoding="utf-8") as fp:
            parser = AccessibilityParser()
            parser.feed(fp.read())
        self.assertEqual(len(parser.ids), len(set(parser.ids)))
        self.assertFalse(parser.images_without_alt)
        unnamed = [
            button for button in parser.buttons
            if not button["text"].strip()
            and not button["attrs"].get("aria-label")
            and not button["attrs"].get("title")
        ]
        self.assertFalse(unnamed)


if __name__ == "__main__":
    unittest.main()
