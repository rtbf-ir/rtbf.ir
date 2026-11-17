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
