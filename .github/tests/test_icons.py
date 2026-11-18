import importlib.util
from io import BytesIO
import json
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import patch

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('download_icons', ROOT / '.github/scripts/download_icons.py')
icons = importlib.util.module_from_spec(spec)
spec.loader.exec_module(icons)


def png(size=(32, 32)):
    output = BytesIO()
    Image.new('RGBA', size, '#ffde00').save(output, format='PNG')
    return output.getvalue()


class ServiceIconsTest(unittest.TestCase):
    def test_naming_normalization_and_collisions(self):
        names = icons.icon_names([{'website': value} for value in [
            'aparat.com/', 'ABOUT.TIPOUL.COM', 'aparat.ir', 'aparat.com',
        ]])
        self.assertEqual(names['aparat.com'], 'aparat.png')
        self.assertEqual(names['about.tipoul.com'], 'about.tipoul.png')
        self.assertRegex(names['aparat.ir'], r'^aparat-[a-f0-9]{8}\.png$')
        self.assertEqual(len(names), len(set(names.values())))
        restored = icons.icon_names([{'website': 'aparat.ir'}], names)
        self.assertEqual(restored['aparat.ir'], names['aparat.ir'])
        reserved = icons.icon_names([{'website': 'aparat.ir'}], {'aparat.com': 'aparat.png'})
        self.assertNotEqual(reserved['aparat.ir'], 'aparat.png')

    def test_existing_icons_are_never_requested_or_overwritten(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary)
            original = png()
            (output / 'aparat.png').write_bytes(original)
            records = [{'website': 'aparat.com'}, {'website': 'new.example'}]
            contacted = []
            def worker(domain, destination, timeout):
                contacted.append(domain)
                destination.write_bytes(png())
                return 'downloaded'
            with patch.object(icons, 'run_worker', side_effect=worker):
                available = icons.download_missing(records, output, workers=1)
                first_manifest = (output / 'index.json').read_bytes()
                icons.download_missing(records, output, workers=1)
            self.assertEqual(contacted, ['new.example'])
            self.assertEqual((output / 'aparat.png').read_bytes(), original)
            self.assertEqual((output / 'index.json').read_bytes(), first_manifest)
            self.assertEqual(available, {'aparat.com': 'aparat.png', 'new.example': 'new.png'})

    def test_fallback_follows_declared_icon_and_redirected_page_base(self):
        calls = []
        def fetch(url, deadline, limit, truncate=False):
            calls.append(url)
            if url.endswith('/favicon.ico'):
                return b'<html>not an icon</html>', url
            if url == 'https://fixture.test/':
                return (b'<base href="/static/"><link rel="shortcut icon" href="../brand.png">',
                        'https://www.fixture.test/welcome/')
            if url == 'https://www.fixture.test/brand.png':
                return png((128, 96)), url
            raise AssertionError(url)
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / 'fixture.png'
            with patch.object(icons, 'fetch_bytes', side_effect=fetch):
                self.assertTrue(icons.fetch_icon('fixture.test', output, 10))
            with Image.open(output) as image:
                self.assertEqual(image.format, 'PNG')
                self.assertEqual(image.size, (64, 48))
            self.assertEqual(calls, ['https://fixture.test/favicon.ico', 'https://fixture.test/',
                                     'https://www.fixture.test/brand.png'])
            self.assertFalse(output.with_suffix('.tmp').exists())

    def test_tracking_pixels_and_fully_transparent_images_are_not_cached(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary) / 'invalid.png'
            with self.assertRaises(ValueError):
                icons.save_png(png((1, 1)), output)
            transparent = BytesIO()
            Image.new('RGBA', (32, 32), (0, 0, 0, 0)).save(transparent, format='PNG')
            with self.assertRaises(ValueError):
                icons.save_png(transparent.getvalue(), output)
            self.assertFalse(output.exists())

    def test_hard_timeout_kills_worker_and_removes_partial_download(self):
        with tempfile.TemporaryDirectory() as temporary:
            worker = Path(temporary) / 'slow_worker.py'
            worker.write_text('import sys,time\nfrom pathlib import Path\np=Path(sys.argv[sys.argv.index("--output")+1])\np.with_suffix(".tmp").write_bytes(b"partial")\ntime.sleep(5)\n')
            output = Path(temporary) / 'slow.png'
            start = time.monotonic()
            with patch.object(icons, '__file__', str(worker)):
                self.assertEqual(icons.run_worker('slow.test', output, 0.3), 'timeout')
            self.assertLess(time.monotonic() - start, 2)
            self.assertFalse(output.exists())
            self.assertFalse(output.with_suffix('.tmp').exists())

    def test_missing_icon_does_not_prevent_other_icons_or_enter_manifest(self):
        with tempfile.TemporaryDirectory() as temporary:
            def worker(domain, destination, timeout):
                if domain == 'missing.test':
                    return 'not found'
                destination.write_bytes(png())
                return 'downloaded'
            with patch.object(icons, 'run_worker', side_effect=worker):
                available = icons.download_missing([{'website': 'missing.test'}, {'website': 'found.test'}], temporary)
            self.assertEqual(available, {'found.test': 'found.png'})
            self.assertEqual(json.loads(Path(temporary, 'index.json').read_text()), available)
            with self.assertRaises(OSError):
                icons.save_png(b'<html>error page</html>', Path(temporary, 'invalid.png'))
            self.assertFalse(Path(temporary, 'invalid.png').exists())


if __name__ == '__main__':
    unittest.main()
