"""Render directory cards into the checked-in page for static hosting."""

from hashlib import sha256
from html import escape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import urlsplit

from build_api import ROOT, services_from


class Instructions(HTMLParser):
    """Keep only the line breaks and HTTP links used in service descriptions."""

    def __init__(self):
        super().__init__()
        self.parts = []
        self.link_open = False

    def handle_data(self, data):
        self.parts.append(escape(data))

    def handle_starttag(self, tag, attrs):
        if tag == "br":
            self.parts.append("<br>")
        if tag == "a" and not self.link_open:
            href = dict(attrs).get("href") or ""
            if urlsplit(href).scheme in {"https", "http"} and urlsplit(href).hostname:
                self.parts.append(f'<a href="{escape(href)}" target="_blank" rel="nofollow noreferrer noopener">')
                self.link_open = True

    def handle_endtag(self, tag):
        if tag == "br":  # Some older records use </br>.
            self.parts.append("<br>")
        if tag == "a" and self.link_open:
            self.parts.append("</a>")
            self.link_open = False

    def render(self, text):
        self.feed(text)
        self.close()
        self.handle_endtag("a")
        return "".join(self.parts)


def render_card(row, service, icons):
    name = escape(service["name"])
    website = escape(service["website_url"])
    status = escape(service["status"])
    category = escape(row["category"])
    priority = service["priority"]
    instructions = Instructions().render(row["info"])
    filename = icons.get(service["domain"], "")
    icon = ""
    if isinstance(filename, str) and re.fullmatch(r"[a-z0-9][a-z0-9._-]*\.png", filename):
        icon = f'<img class="service-icon" src="./assets/img/icons/{filename}" alt="" width="20" height="20" loading="lazy" decoding="async">'
    delete = ""
    if service["delete_url"]:
        delete = (
            f'<a target="_blank" rel="nofollow noreferrer noopener" href="{escape(service["delete_url"])}" '
            f'class="btn label-remove" aria-label="حذف حساب‌کاربری {name}">'
            '<span class="fa fa-trash" aria-hidden="true"></span> حذف حساب‌کاربری</a>'
        )
    return f"""                <div class="float-right" data-category="{category}" data-priority="{priority}" data-status="{status}">
                  <div class="card">
                    <div class="card-body d-flex flex-column">
                      <h5 class="card-title">
                        <a target="_blank" class="text-dark service-name" rel="nofollow noreferrer noopener" title="سایت {name}" href="{website}">{icon}<span>{name}</span></a>
                        <a href="https://github.com/rtbf-ir/rtbf.ir/issues/new/choose"
                           class="text-warning small" aria-label="تصحیح اطلاعات {name}">
                          <small><span class="fas fa-bolt" aria-hidden="true"></span> تصحیح</small>
                        </a>
                      </h5>
                      <p class="card-text"><small>{instructions}</small></p>
                      <div class="card-opt mt-auto">
                        <span class="btn text-light {status}">{escape(service["difficulty"])}</span>{delete}
                      </div>
                    </div>
                  </div>
                </div>"""


def build_directory():
    rows = json.loads((ROOT / "data/data.json").read_text(encoding="utf-8"))
    icons = json.loads((ROOT / "assets/img/icons/index.json").read_text(encoding="utf-8"))
    cards = [
        render_card(row, service, icons)
        for row, service in zip(reversed(rows), reversed(services_from(rows)), strict=True)
    ]
    page = ROOT / "directory.html"
    source = page.read_text(encoding="utf-8")
    start, end = "<!-- BEGIN DIRECTORY CARDS -->", "<!-- END DIRECTORY CARDS -->"
    prefix, middle = source.split(start)
    _, suffix = middle.split(end)
    output = prefix + start + "\n" + "\n".join(cards) + "\n                " + end + suffix
    count = str(len(cards)).translate(str.maketrans("0123456789", "۰۱۲۳۴۵۶۷۸۹"))
    output, count_matches = re.subn(
        r'(<p id="directory-status"[^>]*>)[^<]*(</p>)',
        lambda m: m[1] + count + " نتیجه" + m[2],
        output,
    )
    version = sha256((ROOT / "assets/js/directory.js").read_bytes()).hexdigest()[:12]
    output, script_matches = re.subn(
        r'assets/js/directory\.js\?v=[a-f0-9]+',
        "assets/js/directory.js?v=" + version,
        output,
    )
    if count_matches != 1 or script_matches != 1:
        raise ValueError("Directory page is missing its result count or versioned script")
    if output != source:
        page.write_text(output, encoding="utf-8")
    return len(cards)


if __name__ == "__main__":
    print(f"Rendered {build_directory()} directory cards.")
