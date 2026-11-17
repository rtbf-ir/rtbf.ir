import importlib.util
import json
from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("build_api", ROOT / ".github/scripts/build_api.py")
builder = importlib.util.module_from_spec(spec)
spec.loader.exec_module(builder)


class PublicApiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = json.loads((ROOT / "data/data.json").read_text())
        cls.documents = builder.build_documents(cls.source)
        cls.all = cls.documents["all.json"]["data"]

    def test_records_keep_file_order_and_source_unchanged(self):
        self.assertEqual(len(self.source), len(self.all))
        self.assertEqual([row["name"] for row in self.source], [row["name"] for row in self.all])
        self.assertEqual(len(self.all), len({row["domain"] for row in self.all}))
        self.assertEqual(self.source, json.loads((ROOT / "data/data.json").read_text()))
        for row in self.all:
            self.assertTrue(row["website_url"].startswith("https://"))
            self.assertTrue(row["delete_url"] is None or row["delete_url"].startswith("https://"))
            self.assertNotIn("<a ", row["info"])
            self.assertNotIn("<br>", row["info"])
            self.assertEqual(row, self.documents["services/" + row["domain"] + ".json"]["data"])

    def test_every_filter_combination_has_complete_pages_and_valid_links(self):
        for name, body in self.documents.items():
            if not name.startswith("directory/"):
                continue
            meta = body["meta"]
            filters = meta["filters"]
            expected = [row for row in self.all if all(
                str(row[key]) == value or value == "all" for key, value in filters.items()
            )]
            if meta["sort"] == "newest":
                expected.reverse()
            page = meta["page"]
            self.assertEqual(meta["total"], len(expected), name)
            self.assertEqual(body["data"], expected[(page - 1) * 20:page * 20], name)
            self.assertEqual(meta["total_pages"], max(1, (len(expected) + 19) // 20), name)
            for link in body["links"].values():
                if link:
                    self.assertIn(link.removeprefix("/api/v1/"), self.documents, name)
            self.assertEqual(body["links"]["next"] is None, page == meta["total_pages"])
            self.assertEqual(body["links"]["previous"] is None, page == 1)

    def test_empty_results_and_plain_text(self):
        fixture = [{**self.source[0], "website": "fixture.test", "info": 'متن<br>با <a href="https://example.test">پیوند</a>'}]
        documents = builder.build_documents(fixture)
        row = documents["all.json"]["data"][0]
        self.assertEqual(row["info"], "متن با پیوند")
        self.assertEqual(row["references"], ["https://example.test"])
        empty = documents["directory/all/easy/all/oldest/1.json"] if row["status"] != "easy" else documents["directory/all/hard/all/oldest/1.json"]
        self.assertEqual(empty["data"], [])
        self.assertEqual(empty["meta"]["total_pages"], 1)
        self.assertIsNone(empty["links"]["next"])
        self.assertIsNone(empty["links"]["previous"])

    def test_duplicate_domains_rejected(self):
        fixture = [self.source[0], {**self.source[0], "website": self.source[0]["website"] + "/path"}]
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            builder.build_documents(fixture)


if __name__ == "__main__":
    unittest.main()
