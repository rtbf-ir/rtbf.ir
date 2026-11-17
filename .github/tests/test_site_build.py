"""Verify publication after data edits without any checked-in API responses."""

import importlib.util
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / '.github/scripts'))
import build_site


class PublicationTest(unittest.TestCase):
    def test_rebuild_after_adding_and_removing_services(self):
        source = json.loads((ROOT / 'data/data.json').read_text())
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary) / 'source'
            output = Path(temporary) / 'published'
            for name in ('assets', 'data', 'post', 'api/v1', '.git'):
                (root / name).mkdir(parents=True, exist_ok=True)
            (root / 'index.html').write_text('<main>home</main>')
            (root / 'CNAME').write_text('rtbf.ir\n')
            (root / 'api/v1/client.js').write_text('// client')
            data = root / 'data/data.json'
            data.write_text(json.dumps(source[:21]))
            with patch.object(build_site, 'ROOT', root):
                build_site.build_site(output)
                previous = json.loads((output / 'api/v1/all.json').read_text())
                self.assertEqual(len(previous['data']), 21)
                self.assertTrue((output / 'api/v1/directory/all/all/all/newest/2.json').exists())
                removed = previous['data'][0]['domain']
                added = {**source[0], 'website': 'new-service.test'}
                # The only edit needed between complete builds is to data.json.
                data.write_text(json.dumps([*source[1:19], added]))
                build_site.build_site(output)
            current = json.loads((output / 'api/v1/all.json').read_text())
            self.assertNotEqual(previous['revision'], current['revision'])
            self.assertEqual(len(current['data']), 19)
            self.assertFalse((output / f'api/v1/services/{removed}.json').exists())
            self.assertTrue((output / 'api/v1/services/new-service.test.json').exists())
            self.assertFalse((output / 'api/v1/directory/all/all/all/newest/2.json').exists())
            page = json.loads((output / 'api/v1/directory/all/all/all/newest/1.json').read_text())
            self.assertEqual(page['data'][0]['domain'], 'new-service.test')
            self.assertEqual(page['meta']['total'], 19)
            self.assertIsNone(page['links']['next'])
            self.assertEqual((output / 'CNAME').read_text().strip(), 'rtbf.ir')
            self.assertTrue((output / 'index.html').exists())
            self.assertTrue((output / '.nojekyll').exists())
            self.assertFalse((output / '.git').exists())
            self.assertEqual(list((root / 'api').rglob('*.json')), [])

    def test_existing_unmanaged_directory_is_preserved(self):
        with tempfile.TemporaryDirectory() as temporary:
            target = Path(temporary) / 'existing'
            target.mkdir()
            (target / 'keep.txt').write_text('keep')
            with self.assertRaisesRegex(ValueError, 'Refusing'):
                build_site.build_site(target)
            self.assertEqual((target / 'keep.txt').read_text(), 'keep')


if __name__ == '__main__':
    unittest.main()
