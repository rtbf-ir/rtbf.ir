# Directory data contract

`data.json` is the public directory consumed by rtbf.ir and the browser extensions.

Records are ordered by when they were added. The first record is the oldest and
the last is the newest. Append new services to the end of the array and keep
existing records in place when editing them. The directory shows the array in
reverse for “newest first” and in file order for “oldest first.”

Each record must include:

- `name`: service name.
- `website`: canonical hostname, without a scheme or path.
- `deleteurl`: deletion URL without a scheme, or `#` when no direct route exists.
- `difficulty`: Persian label shown to users.
- `keytype`: one of `easy-label`, `medium-label`, `hard-label`, or `impossible-label`.
- `info`: concise deletion instructions.

`info` is legacy HTML in some records. New records should use plain text only. Links and evidence should be recorded in a future structured `references` field; do not add untrusted HTML to new records.

Every changed record should be manually verified before merge, with its verification date and evidence recorded in the pull request.

## Public API

Edit **only `data/data.json`** to add, update, or remove services. Append new
records at the end. The `Generate API and icons` workflow runs on
every push to `main` and can also be started manually.

It regenerates the complete `api/v1` directory, removes obsolete outputs, and
commits and pushes the result as `github-actions[bot]` using the message
`update generated api and icons`. No commit is created when the output has not changed.
The bot's `GITHUB_TOKEN` push does not trigger another workflow or Pages build,
so the same workflow publishes explicitly after generation. It detects the
existing Pages source: branch publishing requests a new Pages build after the
bot push, and Actions publishing uploads and deploys the generated artifact.

The existing Pages publishing source is preserved. Branch publishing must use
`main` and the repository root (`/`). The repository must allow the workflow to
write to `main`; branch protection may require allowing the bot. No additional
token or secret is required for an unprotected branch. Keep the custom domain
`rtbf.ir`.

All files below `api/v1` are generated. Do not edit them by hand. The previous
`all.json`, `directory/`, and JavaScript SDK paths have been removed.

Local generation and preview:

```sh
python3 .github/scripts/build_api.py
python3 -m http.server 8000
```

Public routes:

- `/api/v1/`: generated health snapshot and available filter values.
- `/api/v1/services/`: every service, newest first.
- `/api/v1/services/aparat.com`: one canonical domain.
- `/api/v1/services/category=e-commerce&priority=2&status=medium-label&sort=oldest`:
  filtered services, in pages of 20 records.

Filters must appear in this exact order: `category`, `priority`, `status`, `sort`.
Use `all` for an unrestricted category, priority, or status. Status codes match
`keytype` in the source, including `-label`. Sort is `newest` or `oldest`.
Follow `links.next` and `links.previous` for pagination; page 2 and later append
`&page=2` etc. The first page has no `page` segment. Invalid or obsolete paths
and out-of-range pages return the host's HTTP 404 response.

These are pre-generated paths, not query parameters. Do not add `?`, rearrange
or omit filters. `&` must be quoted in shell commands. Each extensionless response
also has a `.json` equivalent. For `/api/v1/` and `/services/`, use `index.json`
for an `application/json` Content-Type: Pages serves their raw JSON directory
entry points as `text/html`. All route aliases contain JSON bytes (no script or
HTML redirect), so `curl` and `response.json()` read the response directly.
See [the API documentation](https://rtbf.ir/api-docs).

## Service favicons

After every push to `main`, the publication workflow downloads only missing
favicons into `assets/img/icons` and commits them alongside the generated API.
Each service has a hard 10-second deadline; up to 8 services run concurrently.
Missing or unreachable favicons do not stop publication and are retried on the
next push. Existing PNG files are never requested again or overwritten.

Favicons come from `/favicon.ico` or the site's declared icon links and are
validated and converted to PNG, at most 64 pixels across. SVG-only icons are
skipped unless the site provides a supported raster alternative.
Filenames omit the final domain suffix: `aparat.com` → `aparat.png`,
`about.tipoul.com` → `about.tipoul.png`. If two domains share a filename,
the older record keeps it and the other gets a short deterministic hash suffix.
`assets/img/icons/index.json` maps domains to available files. The directory
loads this local manifest and shows a decorative 20-pixel icon before each name.
Missing icons or a failed manifest request leave the directory usable.

To fetch missing icons locally:

```sh
python3 -m pip install -r .github/scripts/requirements-icons.txt
python3 .github/scripts/download_icons.py --timeout 10 --workers 8
```
