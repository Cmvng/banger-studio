import importlib.util
import pathlib
import unittest


ROOT = pathlib.Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('banger_app_v3_history_test', ROOT / 'app-v3.py')
APP = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(APP)


class BuilderHistoryPatchTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.legacy = (ROOT / 'legacy-app-v7.html').read_text(encoding='utf-8')

    def test_patch_replaces_element_only_json_history(self):
        patched = APP._patch_legacy_builder_history(self.legacy)
        self.assertNotIn(APP.LEGACY_BUILDER_HISTORY_V1, patched)
        self.assertIn(APP.LEGACY_BUILDER_HISTORY_V2, patched)
        self.assertIn("els:copyHistoryEls(els),fmt:fmt,bg:canvas.style.background||'',sel:sel", patched)
        self.assertIn("CustomEvent('banger:builder-undo'", patched)

    def test_patch_is_idempotent(self):
        once = APP._patch_legacy_builder_history(self.legacy)
        twice = APP._patch_legacy_builder_history(once)
        self.assertEqual(once, twice)
        self.assertEqual(twice.count('function copyHistoryEls(list)'), 1)

    def test_history_shares_image_strings_instead_of_json_serialising_them(self):
        self.assertNotIn('JSON.stringify(els)', APP.LEGACY_BUILDER_HISTORY_V2)
        self.assertIn('Object.assign({},e)', APP.LEGACY_BUILDER_HISTORY_V2)
        self.assertIn('if(window.__bapiHistorySuspend)return;', APP.LEGACY_BUILDER_HISTORY_V2)
        self.assertIn("canvas.style.background=state.bg||''", APP.LEGACY_BUILDER_HISTORY_V2)
        self.assertIn('CW=FORMATS[fmt][0];CH=FORMATS[fmt][1]', APP.LEGACY_BUILDER_HISTORY_V2)


if __name__ == '__main__':
    unittest.main()
