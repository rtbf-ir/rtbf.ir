"""Generate the public, versioned JSON API from data/data.json."""

import argparse
import hashlib
from html.parser import HTMLParser
from itertools import product
import json
from pathlib import Path
import re
from urllib.parse import urlsplit


ROOT = Path(__file__).resolve().parents[2]
PAGE_SIZE = 20
BASE = "/api/v1"
STATUSES = ["easy", "medium", "hard", "impossible"]


class PlainText(HTMLParser):
    def __init__(self, source):
        super().__init__(convert_charrefs=True)
        self.parts = []
        self.references = []
        self.feed(source)
        self.close()

    def handle_starttag(self, tag, attrs):
        if tag in {"br", "p", "li", "div"}:
            self.parts.append(" ")
        href = dict(attrs).get("href")
        if tag == "a" and href and href.startswith(("https://", "http://")):
            if href not in self.references:
                self.references.append(href)

    def handle_endtag(self, tag):
        if tag in {"p", "li", "div", "a"}:
            self.parts.append(" ")

    def handle_data(self, text):
        self.parts.append(text)


def services_from(source):
    services = []
    seen = set()
    for row in source:
        website = urlsplit("https://" + row["website"])
        domain = website.hostname.rstrip(".").encode("idna").decode().lower()
        if domain in seen:
            raise ValueError("Duplicate service domain: " + domain)
        seen.add(domain)
        status = row["keytype"].removesuffix("-label")
        if status not in STATUSES:
            raise ValueError("Invalid status: " + row["keytype"])
        category = row["category"] or "uncategorized"
        if not re.fullmatch(r"[a-z0-9-]+", category):
            raise ValueError("Invalid category: " + category)
        deletion = row["deleteurl"]
        instructions = PlainText(row["info"])
        services.append({
            "domain": domain,
            "name": row["name"],
            "website_url": "https://" + row["website"].removeprefix("https://").removeprefix("http://"),
            "delete_url": None if deletion == "#" else "https://" + deletion.removeprefix("https://").removeprefix("http://"),
            "info": " ".join("".join(instructions.parts).split()),
            "references": instructions.references,
            "difficulty": row["difficulty"],
            "status": status,
            "priority": int(row["priority"]),
            "category": category,
        })
        if services[-1]["priority"] not in (1, 2, 3):
            raise ValueError("Invalid priority for " + domain)
    return services


def build_documents(source):
    services = services_from(source)
    revision = hashlib.sha256(json.dumps(source, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()
    categories = sorted({service["category"] for service in services})
    documents = {
        "index.json": {
            "api_version": "1",
            "revision": revision,
            "total": len(services),
            "page_size": PAGE_SIZE,
            "defaults": {"category": "all", "status": "all", "priority": "all", "sort": "newest", "page": 1},
            "filters": {"category": ["all", *categories], "status": ["all", *STATUSES], "priority": ["all", "1", "2", "3"], "sort": ["newest", "oldest"]},
            "links": {
                "all": BASE + "/all.json",
                "directory": BASE + "/directory/all/all/all/newest/1.json",
                "service_template": BASE + "/services/{domain}.json",
                "directory_template": BASE + "/directory/{category}/{status}/{priority}/{sort}/{page}.json",
                "documentation": "/api-docs",
                "client": BASE + "/client.js",
            },
        },
        "all.json": {"api_version": "1", "revision": revision, "data": services},
    }
    for service in services:
        documents["services/" + service["domain"] + ".json"] = {
            "api_version": "1", "revision": revision, "data": service,
        }
    for category, status, priority, sort in product(
        ["all", *categories], ["all", *STATUSES], ["all", "1", "2", "3"], ["newest", "oldest"],
    ):
        selected = [service for service in services if
                    (category == "all" or service["category"] == category) and
                    (status == "all" or service["status"] == status) and
                    (priority == "all" or service["priority"] == int(priority))]
        if sort == "newest":
            selected.reverse()
        total_pages = max(1, (len(selected) + PAGE_SIZE - 1) // PAGE_SIZE)
        prefix = f"directory/{category}/{status}/{priority}/{sort}/"
        for page in range(1, total_pages + 1):
            def link(number):
                return f"{BASE}/{prefix}{number}.json"
            documents[prefix + str(page) + ".json"] = {
                "api_version": "1",
                "revision": revision,
                "data": selected[(page - 1) * PAGE_SIZE:page * PAGE_SIZE],
                "meta": {
                    "total": len(selected), "page": page, "page_size": PAGE_SIZE,
                    "total_pages": total_pages,
                    "filters": {"category": category, "status": status, "priority": priority},
                    "sort": sort,
                },
                "links": {
                    "self": link(page), "first": link(1), "last": link(total_pages),
                    "next": link(page + 1) if page < total_pages else None,
                    "previous": link(page - 1) if page > 1 else None,
                },
            }
    return documents


def write_documents(output, documents):
    """Write a complete API snapshot, removing responses absent from the source."""
    output = Path(output)
    expected = {name: (json.dumps(body, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
                for name, body in documents.items()}
    for path in output.rglob("*.json"):
        if path.relative_to(output).as_posix() not in expected:
            path.unlink()
    for name, content in expected.items():
        destination = output / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "api/v1",
                        help="Destination for generated responses (ignored by Git by default)")
    args = parser.parse_args()
    documents = build_documents(json.loads((ROOT / "data/data.json").read_text()))
    write_documents(args.output, documents)
    print(f"Generated {len(documents)} API files in {args.output}.")


if __name__ == "__main__":
    main()
