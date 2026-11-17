"""Validate JSON-LD and sitemap entries for the static site."""

from datetime import datetime
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import unquote, urlsplit
import xml.etree.ElementTree as ET


SITEMAP_NS = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
LASTMOD_FORMAT = re.compile(
    r"\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2}))?"
)


def reject_json_constant(value):
    raise ValueError(f"{value} is not valid JSON")


class PageMetadata(HTMLParser):
    def __init__(self, path, errors):
        super().__init__()
        self.path = path
        self.errors = errors
        self.canonical = []
        self.json_ld = None

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "link" and "canonical" in (attrs.get("rel") or "").lower().split():
            self.canonical.append(attrs.get("href"))
        if tag == "script" and (attrs.get("type") or "").strip().lower() == "application/ld+json":
            self.json_ld = []
            self.line = self.getpos()[0] + self.get_starttag_text().count("\n")

    def handle_data(self, data):
        if self.json_ld is not None:
            self.json_ld.append(data)

    def handle_endtag(self, tag):
        if tag != "script" or self.json_ld is None:
            return

        try:
            document = json.loads("".join(self.json_ld), parse_constant=reject_json_constant)
            if not isinstance(document, dict) and not (
                isinstance(document, list) and all(isinstance(node, dict) for node in document)
            ):
                raise ValueError("expected a JSON object or an array of objects")
        except ValueError as error:
            line = self.line + getattr(error, "lineno", 1) - 1
            self.errors.append(f"{self.path}:{line}: invalid JSON-LD: {error}")
        self.json_ld = None

    def close(self):
        super().close()
        if self.json_ld is not None:
            self.errors.append(f"{self.path}:{self.line}: unclosed JSON-LD script")


def validate_sitemap(root, pages, errors):
    try:
        sitemap = ET.parse(root / "sitemap.xml").getroot()
    except (OSError, ET.ParseError) as error:
        errors.append(f"sitemap.xml: {error}")
        return

    if sitemap.tag != SITEMAP_NS + "urlset" or len(sitemap) == 0:
        errors.append("sitemap.xml: expected a non-empty sitemap urlset")
        return

    domain = (root / "CNAME").read_text(encoding="utf-8").strip()
    seen = set()
    for index, entry in enumerate(sitemap, start=1):
        label = f"sitemap.xml: entry {index}"
        locations = entry.findall(SITEMAP_NS + "loc")
        if entry.tag != SITEMAP_NS + "url" or len(locations) != 1:
            errors.append(f"{label}: expected a url entry with one loc")
            continue

        url = locations[0].text or ""
        label += f" ({url!r})"
        try:
            parsed = urlsplit(url)
            if (
                len(locations[0]) or any(char.isspace() for char in url)
                or parsed.scheme != "https" or parsed.netloc != domain
                or parsed.query or parsed.fragment
            ):
                raise ValueError("expected an absolute HTTPS page URL on " + domain)
        except ValueError as error:
            errors.append(f"{label}: {error}")
            continue

        if url in seen:
            errors.append(f"{label}: duplicate loc")
        seen.add(url)

        route = unquote(parsed.path).strip("/")
        candidates = [route] if route.endswith(".html") else [
            f"{route}.html", f"{route}/index.html".lstrip("/")
        ]
        if not any(pages.get(candidate) == [url] for candidate in candidates):
            errors.append(f"{label}: does not match the canonical URL of a local page")

        dates = entry.findall(SITEMAP_NS + "lastmod")
        if len(dates) > 1:
            errors.append(f"{label}: multiple lastmod values")
        elif dates:
            value = dates[0].text or ""
            try:
                if len(dates[0]) or not LASTMOD_FORMAT.fullmatch(value):
                    raise ValueError
                datetime.fromisoformat(value)
            except ValueError:
                errors.append(f"{label}: invalid lastmod {value!r}")


def main():
    root = Path(__file__).resolve().parents[2]
    errors = []
    pages = {}
    for file in sorted(root.rglob("*.html")):
        path = file.relative_to(root)
        if any(part.startswith(".") for part in path.parts):
            continue
        parser = PageMetadata(path, errors)
        parser.feed(file.read_text(encoding="utf-8"))
        parser.close()
        pages[path.as_posix()] = parser.canonical

    validate_sitemap(root, pages, errors)
    if errors:
        print("\n".join(errors))
        return 1
    print(f"Validated JSON-LD in {len(pages)} HTML files and checked sitemap URLs and dates.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
