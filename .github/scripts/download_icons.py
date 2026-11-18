"""Download only missing service favicons, with a hard deadline per domain."""

import argparse
from concurrent.futures import ThreadPoolExecutor
import hashlib
from html.parser import HTMLParser
from io import BytesIO
import json
from pathlib import Path
import re
import subprocess
import sys
import time
from urllib.parse import urljoin, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener
import warnings

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_OUTPUT = ROOT / "assets/img/icons"
MAX_IMAGE_BYTES = 1024 * 1024
MAX_PAGE_BYTES = 256 * 1024


def service_domain(website):
    url = urlsplit(website if "://" in website else "https://" + website)
    domain = (url.hostname or "").rstrip(".").encode("idna").decode().lower()
    if url.scheme not in {"http", "https"} or url.username or url.password or not re.fullmatch(r"[a-z0-9][a-z0-9.-]*", domain):
        raise ValueError("Invalid service domain")
    return domain


def icon_names(records, previous=None):
    """Keep the oldest service's short name if two TLDs share the same stem."""
    previous = previous or {}
    names, claimed = {}, set(previous.values())
    for row in records:
        domain = service_domain(row["website"])
        if domain in names:
            continue
        if domain in previous:
            names[domain] = previous[domain]
            continue
        stem = domain.rsplit(".", 1)[0]
        filename = stem + ".png"
        if filename in claimed:
            filename = stem + "-" + hashlib.sha256(domain.encode()).hexdigest()[:8] + ".png"
        claimed.add(filename)
        names[domain] = filename
    return names


class IconLinks(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.base = None
        self.icons = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "base" and self.base is None:
            self.base = attrs.get("href")
        if tag != "link" or not attrs.get("href"):
            return
        rel = set(attrs.get("rel", "").lower().split())
        if "icon" in rel or "apple-touch-icon" in rel or "apple-touch-icon-precomposed" in rel:
            self.icons.append((0 if "icon" in rel else 1, attrs["href"]))

    def urls(self, page_url):
        base = urljoin(page_url, self.base) if self.base else page_url
        return list(dict.fromkeys(urljoin(base, href) for _, href in sorted(self.icons, key=lambda item: item[0])))[:4]


class ShortRedirects(HTTPRedirectHandler):
    max_redirections = 5

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        validate_url(newurl)
        return super().redirect_request(req, fp, code, msg, headers, newurl)


def validate_url(url):
    parts = urlsplit(url)
    if parts.scheme not in {"http", "https"} or not parts.hostname or parts.username or parts.password:
        raise ValueError("Invalid favicon URL")


def fetch_bytes(url, deadline, limit, truncate=False):
    validate_url(url)
    remaining = deadline - time.monotonic()
    if remaining <= 0:
        raise TimeoutError("Service deadline exceeded")
    request = Request(url, headers={"User-Agent": "RTBF-Favicon/1.0 (+https://rtbf.ir)", "Accept-Encoding": "identity"})
    with build_opener(ShortRedirects()).open(request, timeout=min(3, remaining)) as response:
        chunks, length = [], 0
        while length <= limit:
            if time.monotonic() >= deadline:
                raise TimeoutError("Service deadline exceeded")
            block = response.read(min(16384, limit + 1 - length))
            if not block:
                break
            chunks.append(block)
            length += len(block)
        body = b"".join(chunks)
        if len(body) > limit and not truncate:
            raise ValueError("Favicon is too large")
        return body[:limit], response.geturl()


def save_png(payload, destination):
    from PIL import Image

    with warnings.catch_warnings():
        warnings.simplefilter("error", Image.DecompressionBombWarning)
        with Image.open(BytesIO(payload)) as image:
            if image.format not in {"PNG", "ICO", "JPEG", "GIF", "WEBP", "BMP"} or min(image.size) < 8 or image.width * image.height > 4_000_000:
                raise ValueError("Unsupported favicon image")
            image = image.convert("RGBA")
            if image.getbbox() is None:
                raise ValueError("Empty favicon image")
            image.thumbnail((64, 64), Image.Resampling.LANCZOS)
            # The final filename appears only after a complete, validated image.
            temporary = destination.with_suffix(".tmp")
            try:
                image.save(temporary, format="PNG", optimize=True)
                if not destination.exists():
                    temporary.replace(destination)
            finally:
                temporary.unlink(missing_ok=True)


def fetch_icon(domain, destination, timeout):
    if destination.is_file():
        return True
    deadline = time.monotonic() + timeout
    origin = "https://" + domain

    def attempt(url):
        try:
            payload, _ = fetch_bytes(url, deadline, MAX_IMAGE_BYTES)
            save_png(payload, destination)
            return True
        except (OSError, ValueError, TimeoutError, Warning):
            return False

    if attempt(origin + "/favicon.ico"):
        return True
    try:
        page, page_url = fetch_bytes(origin + "/", deadline, MAX_PAGE_BYTES, truncate=True)
        links = IconLinks()
        links.feed(page.decode("utf-8", errors="replace"))
        for url in links.urls(page_url):
            if attempt(url):
                return True
    except (OSError, ValueError, TimeoutError):
        pass
    return False


def run_worker(domain, destination, timeout):
    if destination.is_file():
        return "existing"
    try:
        result = subprocess.run(
            [sys.executable, str(Path(__file__).resolve()), "--fetch", domain,
             "--output", str(destination), "--timeout", str(timeout)],
            timeout=timeout, capture_output=True,
        )
        return "downloaded" if result.returncode == 0 and destination.is_file() else "not found"
    except subprocess.TimeoutExpired:
        return "timeout"
    finally:
        destination.with_suffix(".tmp").unlink(missing_ok=True)


def download_missing(records, output, timeout=10, workers=8):
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    try:
        previous = json.loads((output / "index.json").read_text())
    except (OSError, ValueError):
        previous = {}
    previous = {domain: name for domain, name in previous.items()
                if isinstance(domain, str) and isinstance(name, str)
                and re.fullmatch(r"[a-z0-9][a-z0-9._-]*\.png", name) and (output / name).is_file()} if isinstance(previous, dict) else {}
    names = icon_names(records, previous)
    pending = [(domain, output / name) for domain, name in names.items() if not (output / name).is_file()]
    print(f"Skipping {len(names) - len(pending)} existing icons; looking for {len(pending)} missing icons.", flush=True)

    def download(item):
        domain, destination = item
        outcome = run_worker(domain, destination, timeout)
        print(f"{domain}: {outcome}", flush=True)
        return outcome

    with ThreadPoolExecutor(max_workers=workers) as pool:
        outcomes = list(pool.map(download, pending))
    # Keep ownership of existing files even if a service temporarily leaves the data.
    available = {**previous, **{domain: name for domain, name in sorted(names.items()) if (output / name).is_file()}}
    manifest = json.dumps(available, ensure_ascii=False, sort_keys=True, separators=(",", ":")) + "\n"
    (output / "index.json").write_text(manifest, encoding="utf-8")
    print(f"Icons available: {len(available)}; downloaded: {outcomes.count('downloaded')}; timeouts: {outcomes.count('timeout')}.")
    return available


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--timeout", type=float, default=10, help="Hard deadline in seconds for each service")
    parser.add_argument("--workers", type=int, default=8)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--fetch", help=argparse.SUPPRESS)
    args = parser.parse_args()
    if args.timeout <= 0 or not 1 <= args.workers <= 16:
        parser.error("Use a positive timeout and 1–16 workers")
    if args.fetch:
        raise SystemExit(0 if fetch_icon(service_domain(args.fetch), args.output, args.timeout) else 1)
    records = json.loads((ROOT / "data/data.json").read_text())
    download_missing(records, args.output, args.timeout, args.workers)


if __name__ == "__main__":
    main()
