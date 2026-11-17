import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { createClient, hostnameFrom, RtbfApiError } from "../../api/v1/client.js";

const snapshot = JSON.parse(readFileSync(new URL("../../_site/api/v1/all.json", import.meta.url), "utf8"));
const client = createClient({ fetch: async () => ({ ok: true, json: async () => structuredClone(snapshot) }) });

test("URL lookup matches subdomains and ignores path, query and port", async () => {
  for (const input of ["aparat.com", "https://www.aparat.com/path?ref=test", "//www.aparat.com/", "https://WWW.APARAT.COM.:8443/path"]) {
    assert.equal((await client.lookup(input)).data.domain, "aparat.com");
  }
  assert.equal((await client.lookup("aparat.com.evil.test")).data, null);
  assert.equal((await client.lookup("not-aparat.com")).data, null);
  assert.equal(hostnameFrom("https://مثال.ایران"), "xn--mgbh0fb.xn--mgba3a4f16a");
  for (const input of ["", "ftp://aparat.com", "https://user:password@aparat.com", "javascript:alert(1)"]) {
    await assert.rejects(client.lookup(input));
  }
});

test("longest matching known domain wins", async () => {
  const custom = createClient({ fetch: async () => ({ ok: true, json: async () => ({
    ...snapshot, data: [{ domain: "example.test" }, { domain: "app.example.test" }],
  }) }) });
  assert.equal((await custom.lookup("https://www.app.example.test")).data.domain, "app.example.test");
});

test("combined filters preserve oldest/newest order and paginate", async () => {
  const expected = snapshot.data.filter(row => row.category === "provider" && row.status === "hard" && row.priority === 3);
  const oldest = await client.list({ category: "provider", status: "hard", priority: 3, sort: "oldest", pageSize: 2 });
  assert.deepEqual(oldest.data, expected.slice(0, 2));
  assert.equal(oldest.meta.total, expected.length);
  assert.deepEqual((await client.list({ sort: "oldest", page: 2, pageSize: 20 })).data, snapshot.data.slice(20, 40));
  assert.deepEqual((await client.list()).data, snapshot.data.toReversed().slice(0, 20));
  assert.equal((await client.list({ q: "پیدانمی‌شود-نمونه", pageSize: 1 })).meta.total, 0);
  assert.equal((await client.list({ q: "[" })).meta.total, snapshot.data.filter(row => row.name.includes("[")).length);
  assert.equal((await client.list({ q: "  كافه   بازار  " })).data[0].domain, "cafebazaar.ir");
  assert.equal((await client.list({ q: "APARAT.COM" })).data[0].domain, "aparat.com");
});

test("invalid filter and paging arguments reject", async () => {
  for (const options of [
    { category: "missing" }, { status: "missing" }, { priority: 99 }, { sort: "missing" },
    { page: 0 }, { page: 1.2 }, { page: 10000 }, { pageSize: 0 }, { pageSize: 101 }, { q: null },
  ]) await assert.rejects(client.list(options));
});

test("one client reuses its snapshot and retries after failed requests", async () => {
  let calls = 0;
  const custom = createClient({ fetch: async () => {
    calls++;
    return { ok: calls > 1, status: 503, json: async () => structuredClone(snapshot) };
  } });
  await assert.rejects(custom.lookup("aparat.com"), error => error instanceof RtbfApiError && error.status === 503);
  await Promise.all([custom.lookup("aparat.com"), custom.list(), custom.lookup("unknown.test")]);
  assert.equal(calls, 2);
});

test("network failures are typed and allow retry", async () => {
  let online = false;
  const custom = createClient({ fetch: async () => {
    if (!online) throw new TypeError("offline");
    return { ok: true, json: async () => snapshot };
  } });
  await assert.rejects(custom.list(), error => error instanceof RtbfApiError && error.status === 0);
  online = true;
  assert.equal((await custom.lookup("aparat.com")).data.domain, "aparat.com");
});
