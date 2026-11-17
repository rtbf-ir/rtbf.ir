import { createRequire } from "node:module";
import { test, expect } from "@playwright/test";

const require = createRequire(import.meta.url);
const bootstrap = new Map([
  ["https://cdn.jsdelivr.net/npm/bootstrap@5.0.1/dist/css/bootstrap.min.css", {
    path: require.resolve("bootstrap/dist/css/bootstrap.min.css"), contentType: "text/css",
  }],
  ["https://cdn.jsdelivr.net/npm/bootstrap@5.0.1/dist/js/bootstrap.bundle.min.js", {
    path: require.resolve("bootstrap/dist/js/bootstrap.bundle.min.js"), contentType: "application/javascript",
  }],
]);

test.beforeEach(async ({ page, baseURL }) => {
  const origin = new URL(baseURL).origin;
  await page.route(url => url.origin !== origin, async route => {
    const asset = bootstrap.get(route.request().url());
    if (asset) await route.fulfill({ ...asset, headers: { "Access-Control-Allow-Origin": "*" } });
    else await route.abort();
  });
});

test("requested API routes return JSON over HTTP and obsolete routes are gone", async ({ request }) => {
  const health = await request.get("/api/v1/");
  expect(health.status()).toBe(200);
  const snapshot = await health.json();
  expect(snapshot.status).toBe("ok");
  const all = await (await request.get("/api/v1/services/")).json();
  expect(all.data).toHaveLength(snapshot.total);
  const service = await request.get("/api/v1/services/aparat.com");
  expect(service.status()).toBe(200);
  expect((await service.json()).data.domain).toBe("aparat.com");
  for (const path of ["/api/v1/all.json", "/api/v1/client.js", "/api/v1/directory/all/all/all/newest/1.json"]) {
    expect((await request.get(path)).status()).toBe(404);
  }
  const response = await request.get("/api/v1/services/category=all&priority=all&status=all&sort=newest");
  expect(response.status()).toBe(200);
  const first = await response.json();
  expect(first.data).toHaveLength(20);
  expect(first.meta.page).toBe(1);
  const next = await request.get(first.links.next);
  const second = await next.json();
  expect(second.meta.page).toBe(2);
  expect(second.links.previous).toBe(first.links.self);
  expect(first.data.some(a => second.data.some(b => a.domain === b.domain))).toBe(false);
  const examplePath = "/api/v1/services/category=e-commerce&priority=2&status=medium-label&sort=oldest";
  const example = await request.get(examplePath);
  expect(example.status()).toBe(200);
  const typed = await request.get(examplePath + ".json");
  expect(typed.headers()["content-type"]).toContain("application/json");
  expect(await typed.json()).toEqual(await example.json());
  const filtered = await (await request.get("/api/v1/services/category=provider&priority=3&status=hard-label&sort=oldest")).json();
  expect(filtered.data.length).toBeGreaterThan(0);
  expect(filtered.data.every(row => row.status === "hard-label" && row.category === "provider" && row.priority === 3)).toBe(true);
  expect((await request.get("/api/v1/services/unregistered.example")).status()).toBe(404);
});

test("documentation is linked from the site and usable on a narrow screen", async ({ page }) => {
  await page.goto("/directory.html");
  await expect(page.getByRole("navigation", { name: "منوی اصلی", exact: true })
    .getByRole("link", { name: "مستندات API" })).toHaveAttribute("href", "api-docs");
  await expect(page.getByRole("navigation", { name: "منوی اصلی", exact: true })
    .getByRole("link", { name: "مستندات API" }).locator(".fa-book")).toHaveAttribute("aria-hidden", "true");
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/api-docs.html");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "رفتن به محتوای اصلی" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
