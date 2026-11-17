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

Edit **only `data/data.json`** to add, update, or remove a service. Keep new
services at the end of the array. Generated API responses are not committed.

On each push to `main`, the Pages workflow builds the site and all versioned API
responses into `_site`, then publishes that artifact. Added services receive
lookup responses automatically; removed services disappear, and filters,
counts, pagination, and revisions are rebuilt from the same snapshot.

One-time repository setup: in **Settings → Pages → Build and deployment → Source**,
select **GitHub Actions**. Keep the existing custom domain `rtbf.ir`. Until this
is configured and the workflow is pushed, automatic API publication is not active.

For a complete local preview, run:

```sh
python3 .github/scripts/build_site.py
python3 -m http.server 8000 --directory _site
```

Re-run the build after editing source files. `_site/` and generated JSON files
are ignored by Git. Browser tests build and serve this same publication output.
CI validates the data, response format, and pagination without requiring generated
files in a commit.

The API uses plain-text instructions, absolute website/deletion URLs, and
paginated directory paths. See [the API documentation](https://rtbf.ir/api-docs)
for the complete v1 response format and JavaScript client.
