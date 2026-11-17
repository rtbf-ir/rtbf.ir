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
STATUSES = ["easy-label", "medium-label", "hard-label", "impossible-label"]


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
        status = row["keytype"]
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


def filter_route(category, priority, status, sort, page=1):
    route = f"{BASE}/services/category={category}&priority={priority}&status={status}&sort={sort}"
    return route if page == 1 else route + f"&page={page}"


def build_documents(source):
    services = services_from(source)
    revision = hashlib.sha256(json.dumps(source, ensure_ascii=False, separators=(",", ":")).encode()).hexdigest()
    categories = sorted({service["category"] for service in services})
    common = {"api_version": "1", "revision": revision}
    documents = {
        "index.json": {
            **common, "status": "ok", "total": len(services), "page_size": PAGE_SIZE,
            "filters": {"category": ["all", *categories], "priority": ["all", "1", "2", "3"],
                        "status": ["all", *STATUSES], "sort": ["newest", "oldest"]},
            "links": {"services": BASE + "/services/", "documentation": "/api-docs"},
        },
        "services/index.json": {**common, "data": list(reversed(services)), "meta": {"total": len(services)}},
    }
    for service in services:
        documents["services/" + service["domain"] + ".json"] = {**common, "data": service}
    for category, priority, status, sort in product(
        ["all", *categories], ["all", "1", "2", "3"], ["all", *STATUSES], ["newest", "oldest"],
    ):
        selected = [service for service in services if
                    (category == "all" or service["category"] == category) and
                    (priority == "all" or service["priority"] == int(priority)) and
                    (status == "all" or service["status"] == status)]
        if sort == "newest":
            selected.reverse()
        total_pages = max(1, (len(selected) + PAGE_SIZE - 1) // PAGE_SIZE)
        for page in range(1, total_pages + 1):
            def link(number):
                return filter_route(category, priority, status, sort, number)
            documents[link(page).removeprefix(BASE + "/") + ".json"] = {
                **common,
                "data": selected[(page - 1) * PAGE_SIZE:page * PAGE_SIZE],
                "meta": {
                    "total": len(selected), "page": page, "page_size": PAGE_SIZE, "total_pages": total_pages,
                    "filters": {"category": category, "priority": priority, "status": status}, "sort": sort,
                },
                "links": {
                    "self": link(page), "first": link(1), "last": link(total_pages),
                    "next": link(page + 1) if page < total_pages else None,
                    "previous": link(page - 1) if page > 1 else None,
                },
            }
    return documents


def route_alias(name):
    # Directory entry points require index.html on Pages. Other routes are
    # literal extensionless files, so & belongs to the path, not a query string.
    return name[:-len("index.json")] + "index.html" if name.endswith("index.json") else name[:-len(".json")]


def write_documents(output, documents):
    """Replace the generated API, including obsolete JSON and route aliases."""
    output = Path(output).resolve()
    if output == ROOT or output in ROOT.parents:
        raise ValueError("The API output must be separate from the source root")
    expected = {}
    for name, body in documents.items():
        # Directory aliases are served as HTML by Pages. Escape markup so a
        # service name or instruction can never become executable HTML.
        content = json.dumps(body, ensure_ascii=False, separators=(",", ":"))
        for char in "<>&":
            content = content.replace(char, "\\u%04x" % ord(char))
        encoded = (content + "\n").encode()
        expected[name] = encoded
        expected[route_alias(name)] = encoded
    output.mkdir(parents=True, exist_ok=True)
    for path in output.rglob("*"):
        if path.is_file() and path.relative_to(output).as_posix() not in expected:
            path.unlink()
    for name, content in expected.items():
        destination = output / name
        destination.parent.mkdir(parents=True, exist_ok=True)
        if not destination.exists() or destination.read_bytes() != content:
            destination.write_bytes(content)
    for path in sorted(output.rglob("*"), reverse=True):
        if path.is_dir() and not any(path.iterdir()):
            path.rmdir()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "api/v1",
                        help="Destination reserved entirely for generated API responses")
    args = parser.parse_args()
    documents = build_documents(json.loads((ROOT / "data/data.json").read_text()))
    write_documents(args.output, documents)
    print(f"Generated {len(documents)} JSON responses and their route aliases in {args.output}.")


if __name__ == "__main__":
    main()
