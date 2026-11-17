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

test("public directory API filters and next/previous links work over HTTP", async ({ request }) => {
  const response = await request.get("/api/v1/directory/all/all/all/newest/1.json");
  expect(response.status()).toBe(200);
  const first = await response.json();
  expect(first.data).toHaveLength(20);
  expect(first.meta.page).toBe(1);
  const next = await request.get(first.links.next);
  const second = await next.json();
  expect(second.meta.page).toBe(2);
  expect(second.links.previous).toBe(first.links.self);
  expect(first.data.some(a => second.data.some(b => a.domain === b.domain))).toBe(false);
  const filtered = await (await request.get("/api/v1/directory/provider/hard/3/oldest/1.json")).json();
  expect(filtered.data.length).toBeGreaterThan(0);
  expect(filtered.data.every(row => row.status === "hard" && row.category === "provider" && row.priority === 3)).toBe(true);
  expect((await request.get("/api/v1/services/unregistered.example.json")).status()).toBe(404);
});

test("API documentation supports URL lookup and paginated filtered requests", async ({ page }) => {
  await page.goto("/api-docs.html");
  await expect(page.getByRole("heading", { name: "مستندات API حق فراموش شدن" })).toBeVisible();
  await page.getByRole("button", { name: "بررسی سرویس" }).click();
  await expect(page.locator("#api-lookup-status")).toHaveText("سرویس پیدا شد.");
  expect(JSON.parse(await page.locator("#api-lookup-response").textContent()).data.domain).toBe("aparat.com");
  await page.getByLabel("URL یا دامنهٔ سرویس").fill("https://unregistered.example/path");
  await page.getByRole("button", { name: "بررسی سرویس" }).click();
  await expect(page.locator("#api-lookup-status")).toHaveText("این دامنه در دایرکتوری ثبت نشده است.");

  await expect(page.getByLabel("دسته‌بندی API").locator('option[value="provider"]')).toBeAttached();
  await page.getByRole("button", { name: "دریافت فهرست" }).click();
  await expect(page.locator("#api-list-status")).toContainText("صفحهٔ ۱");
  await page.getByRole("button", { name: "صفحهٔ بعد", exact: true }).click();
  await expect(page.locator("#api-list-status")).toContainText("صفحهٔ ۲");
  await page.getByRole("button", { name: "صفحهٔ قبل", exact: true }).click();
  await expect(page.locator("#api-list-status")).toContainText("صفحهٔ ۱");

  await page.getByLabel("دسته‌بندی API").selectOption("provider");
  await page.getByLabel("سختی حذف").selectOption("hard");
  await page.getByLabel("ترتیب API").selectOption("oldest");
  await page.getByRole("button", { name: "دریافت فهرست" }).click();
  await expect(page.locator("#api-list-url")).toHaveAttribute("href", /\/provider\/hard\/all\/oldest\/1.json$/);
  await expect(page.locator("#api-list-status")).toContainText("صفحهٔ ۱");
  const output = JSON.parse(await page.locator("#api-list-response").textContent());
  expect(output.data.every(row => row.status === "hard" && row.category === "provider")).toBe(true);
});

test("documentation is linked from the site and usable on a narrow screen", async ({ page }) => {
  await page.goto("/directory.html");
  await expect(page.getByRole("navigation", { name: "منوی اصلی", exact: true })
    .getByRole("link", { name: "مستندات API" })).toHaveAttribute("href", "api-docs");
  await page.setViewportSize({ width: 390, height: 700 });
  await page.goto("/api-docs.html");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "رفتن به محتوای اصلی" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
