import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('build_api', ROOT / '.github/scripts/build_api.py')
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class PublicApiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = json.loads((ROOT / 'data/data.json').read_text())
        cls.documents = builder.build_documents(cls.source)
        cls.services = builder.services_from(cls.source)

    def test_requested_routes_and_source_order(self):
        self.assertEqual(self.documents['index.json']['status'], 'ok')
        self.assertEqual(self.documents['index.json']['total'], len(self.source))
        self.assertEqual(self.documents['services/index.json']['data'], self.services[::-1])
        self.assertEqual(len(self.services), len({r['domain'] for r in self.services}))
        self.assertEqual([r['name'] for r in self.source], [r['name'] for r in self.services])
        self.assertNotIn('all.json', self.documents)
        self.assertFalse(any(name.startswith('directory/') for name in self.documents))
        for row, source in zip(self.services, self.source):
            self.assertEqual(row['status'], source['keytype'])
            self.assertEqual(self.documents['services/' + row['domain'] + '.json']['data'], row)
            self.assertTrue(row['website_url'].startswith('https://'))
            self.assertTrue(row['delete_url'] is None or row['delete_url'].startswith('https://'))
            self.assertNotIn('<a ', row['info'])
        self.assertIn('services/category=e-commerce&priority=2&status=medium-label&sort=oldest.json', self.documents)

    def test_all_filters_ordering_pagination_and_links(self):
        for name, document in self.documents.items():
            if not name.startswith('services/category='):
                continue
            meta = document['meta']
            expected = [r for r in self.services if all(
                value == 'all' or str(r[key]) == value for key, value in meta['filters'].items()
            )]
            if meta['sort'] == 'newest':
                expected.reverse()
            page = meta['page']
            self.assertEqual(meta['total'], len(expected), name)
            self.assertEqual(document['data'], expected[(page-1)*20:page*20], name)
            self.assertEqual(meta['total_pages'], max(1, (len(expected)+19)//20), name)
            self.assertNotIn('&page=1', document['links']['first'])
            for link in document['links'].values():
                if link:
                    self.assertIn(link.removeprefix('/api/v1/') + '.json', self.documents, name)
            self.assertEqual(document['links']['next'] is None, page == meta['total_pages'])
            self.assertEqual(document['links']['previous'] is None, page == 1)

    def test_generated_routes_are_json_and_safe_for_html_entry_points(self):
        source = [{**self.source[0], 'website': 'fixture.test', 'name': '<script>alert(1)</script>',
                   'info': 'متن<br>با <a href="https://example.test">پیوند</a>'}]
        documents = builder.build_documents(source)
        row = documents['services/fixture.test.json']['data']
        self.assertEqual(row['info'], 'متن با پیوند')
        self.assertEqual(row['references'], ['https://example.test'])
        with tempfile.TemporaryDirectory() as temporary:
            builder.write_documents(temporary, documents)
            for name, body in documents.items():
                primary = Path(temporary, name).read_bytes()
                alias = Path(temporary, builder.route_alias(name)).read_bytes()
                self.assertEqual(primary, alias, name)
                self.assertEqual(json.loads(alias), body, name)
                self.assertNotIn(b'<', alias)
                self.assertNotIn(b'>', alias)
            self.assertEqual(builder.route_alias('index.json'), 'index.html')
            self.assertEqual(builder.route_alias('services/index.json'), 'services/index.html')
            self.assertEqual(builder.route_alias('services/aparat.com.json'), 'services/aparat.com')

    def test_regeneration_is_idempotent_and_removes_old_routes(self):
        with tempfile.TemporaryDirectory() as temporary:
            output = Path(temporary)
            (output / 'directory').mkdir()
            (output / 'directory/old.json').write_text('{}')
            (output / 'all.json').write_text('{}')
            (output / 'client.js').write_text('// old SDK')
            before = builder.build_documents(self.source[:21])
            builder.write_documents(output, before)
            original = {p.relative_to(output): p.read_bytes() for p in output.rglob('*') if p.is_file()}
            builder.write_documents(output, before)
            self.assertEqual(original, {p.relative_to(output): p.read_bytes() for p in output.rglob('*') if p.is_file()})
            removed = self.services[0]['domain']
            updated = [*self.source[1:19], {**self.source[0], 'website': 'new-service.test'}]
            after = builder.build_documents(updated)
            builder.write_documents(output, after)
            self.assertFalse((output / ('services/' + removed)).exists())
            self.assertFalse((output / ('services/' + removed + '.json')).exists())
            self.assertTrue((output / 'services/new-service.test').exists())
            self.assertNotEqual(before['index.json']['revision'], after['index.json']['revision'])
            for path in ('all.json', 'client.js', 'directory'):
                self.assertFalse((output / path).exists())
            self.assertFalse(any('&page=2' in p.name for p in output.rglob('*')))
            self.assertEqual(json.loads((output / 'services/index.html').read_text())['meta']['total'], 19)

    def test_duplicate_domains_rejected(self):
        with self.assertRaisesRegex(ValueError, 'Duplicate'):
            builder.build_documents([self.source[0], {**self.source[0], 'website': self.source[0]['website'] + '/path'}])


if __name__ == '__main__':
    unittest.main()
