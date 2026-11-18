import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test, expect } from "@playwright/test";

const require = createRequire(import.meta.url);
const bootstrapAssets = new Map([
  ["https://cdn.jsdelivr.net/npm/bootstrap@5.0.1/dist/css/bootstrap.min.css", {
    path: require.resolve("bootstrap/dist/css/bootstrap.min.css"),
    contentType: "text/css",
  }],
  ["https://cdn.jsdelivr.net/npm/bootstrap@5.0.1/dist/js/bootstrap.bundle.min.js", {
    path: require.resolve("bootstrap/dist/js/bootstrap.bundle.min.js"),
    contentType: "application/javascript",
  }],
]);
const records = JSON.parse(readFileSync(new URL("../../data/data.json", import.meta.url), "utf-8"));
const examples = [
  { name: "سرویس قدیمی", website: "older.example.test", keytype: "hard-label", difficulty: "سخت" },
  { name: "سرویس ساده", website: "easy.example.test", keytype: "easy-label", difficulty: "ساده" },
  { name: "سرویس جدید", website: "newer.example.test", keytype: "hard-label", difficulty: "سخت" },
].map(record => ({
  category: "provider",
  priority: "3",
  deleteurl: "#",
  info: "درخواست را به پشتیبانی بفرستید.",
  ...record,
}));

test.beforeEach(async ({ context, baseURL }) => {
  const origin = new URL(baseURL).origin;
  await context.route(url => url.origin !== origin, async route => {
    const asset = bootstrapAssets.get(route.request().url());
    if (!asset) {
      await route.abort();
      return;
    }
    await route.fulfill({ ...asset, headers: { "Access-Control-Allow-Origin": "*" } });
  });
});

async function expectServiceOrder(page, expected) {
  const cards = page.locator(".directoryData .card-title > a:first-child");
  await expect.poll(() => cards.evaluateAll(links => links.map(link => link.getAttribute("href"))))
    .toEqual(expected.map(service => "https://" + service.website));
}

test("sorts services by their position in the data file", async ({ page }) => {
  // Unversioned URLs can resolve to a previously cached directory script.
  await page.route(url => url.pathname.endsWith("/assets/js/directory.js") && !url.search,
    route => route.abort());
  await page.goto("/directory.html");
  const script = readFileSync(new URL("../../assets/js/directory.js", import.meta.url));
  const version = createHash("sha256").update(script).digest("hex").slice(0, 12);
  await expect(page.locator('script[src^="assets/js/directory.js"]'))
    .toHaveAttribute("src", `assets/js/directory.js?v=${version}`);

  const sort = page.getByLabel("مرتب‌سازی");
  const reset = page.locator("#directory-reset");
  await expect(reset).toBeAttached();
  await expect(sort).toHaveValue("newest");
  await expectServiceOrder(page, records.toReversed());
  await expect(reset).toBeHidden();

  await sort.selectOption("oldest");
  await expect(page).toHaveURL(/#sort=oldest$/);
  await expectServiceOrder(page, records);
  await expect(reset).toBeVisible();

  await sort.selectOption("newest");
  await expect(page).toHaveURL(/\/directory\.html$/);
  await expectServiceOrder(page, records.toReversed());
  await expect(reset).toBeHidden();
});

test("restores search, filters, and sort in a fresh tab from the shared link", async ({ context, page }) => {
  await context.route("**/data/data.json", route => route.fulfill({ json: examples }));
  await page.goto("/directory.html");
  await page.getByLabel("نام سرویس").fill("example.test");
  await page.getByLabel("وضعیت سرویس‌ها").selectOption("hard-label");
  await page.getByLabel("دسته‌بندی سرویس‌ها").selectOption("provider");
  await page.getByLabel("اولویت سرویس‌ها").selectOption("3");
  await page.getByLabel("مرتب‌سازی").selectOption("oldest");
  const expected = [examples[0], examples[2]];
  await expectServiceOrder(page, expected);

  const recipient = await context.newPage();
  await recipient.goto(page.url());
  await expect(recipient.getByLabel("نام سرویس")).toHaveValue("example.test");
  await expect(recipient.getByLabel("وضعیت سرویس‌ها")).toHaveValue("hard-label");
  await expect(recipient.getByLabel("دسته‌بندی سرویس‌ها")).toHaveValue("provider");
  await expect(recipient.getByLabel("اولویت سرویس‌ها")).toHaveValue("3");
  await expect(recipient.getByLabel("مرتب‌سازی")).toHaveValue("oldest");
  await expectServiceOrder(recipient, expected);

  await recipient.getByRole("button", { name: "پاک کردن فیلترها" }).click();
  await expect(recipient).toHaveURL(/\/directory\.html$/);
  await expect(recipient.getByLabel("مرتب‌سازی")).toHaveValue("newest");
  await expectServiceOrder(recipient, examples.toReversed());
  await expect(recipient.getByRole("button", { name: "پاک کردن فیلترها" })).toBeHidden();
});

test("supports keyboard navigation, retry, and clearing a search", async ({ page }) => {
  let requests = 0;
  await page.route("**/data/data.json", route => {
    requests += 1;
    return requests === 1 ? route.fulfill({ status: 503 }) : route.fulfill({ json: examples });
  });
  await page.goto("/directory.html");
  const retry = page.getByRole("button", { name: "تلاش دوباره" });
  await expect(retry).toBeVisible();

  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "رفتن به محتوای اصلی" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("main").getByRole("link", { name: "ثبت سرویس/سایت جدید به لیست" })).toBeFocused();
  await page.keyboard.press("Tab");
  const search = page.getByLabel("نام سرویس");
  await expect(search).toBeFocused();
  await page.keyboard.type("older");

  const reset = page.getByRole("button", { name: "پاک کردن فیلترها" });
  for (const control of [
    page.getByLabel("وضعیت سرویس‌ها"),
    page.getByLabel("دسته‌بندی سرویس‌ها"),
    page.getByLabel("اولویت سرویس‌ها"),
    page.getByLabel("مرتب‌سازی"),
    reset,
    retry,
  ]) {
    await page.keyboard.press("Tab");
    await expect(control).toBeFocused();
  }
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toBeFocused();
  await expectServiceOrder(page, [examples[0]]);
  expect(requests).toBe(2);

  await page.keyboard.press("Shift+Tab");
  await expect(reset).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(search).toBeFocused();
  await expect(reset).toBeHidden();
  await expectServiceOrder(page, examples.toReversed());
});


test("shows local favicons to the right of service names and hides broken images", async ({ page }) => {
  await page.route("**/data/data.json", route => route.fulfill({ json: examples }));
  await page.route("**/assets/img/icons/index.json", route => route.fulfill({ json: {
    "older.example.test": "older.example.png", "newer.example.test": "newer.example.png",
  } }));
  await page.route("**/assets/img/icons/older.example.png", route => route.fulfill({
    contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAANElEQVR4nO3QQQ0AAAgDMcC/RqxAUMGnM3BLczomHlefcQcIECBAgAABAgQIECBAgACBE1gruQMcSeP50QAAAABJRU5ErkJggg==", "base64"),
  }));
  await page.route("**/assets/img/icons/newer.example.png", route => route.fulfill({ status: 404 }));
  await page.goto("/directory.html");
  const service = page.getByRole("link", { name: "سرویس قدیمی", exact: true });
  await service.scrollIntoViewIfNeeded();
  const icon = service.locator("img");
  await expect(icon).toHaveAttribute("alt", "");
  await expect(icon).toHaveAttribute("width", "20");
  await expect.poll(() => icon.evaluate(image => image.naturalWidth)).toBeGreaterThan(0);
  for (const width of [1280, 390]) {
    await page.setViewportSize({ width, height: 800 });
    await service.scrollIntoViewIfNeeded();
    const imageBox = await icon.boundingBox();
    const nameBox = await service.locator("span").boundingBox();
    expect(imageBox.x).toBeGreaterThanOrEqual(nameBox.x + nameBox.width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }

  await page.getByLabel("نام سرویس").fill("newer");
  await expectServiceOrder(page, [examples[2]]);
  await expect(page.locator(".directoryData img.service-icon")).toHaveCount(0);
  await page.getByLabel("نام سرویس").fill("older");
  await expect(page.locator(".directoryData img.service-icon")).toHaveCount(1);
});

test("keeps the directory usable when the icon manifest is unavailable", async ({ page }) => {
  await page.route("**/data/data.json", route => route.fulfill({ json: examples }));
  await page.route("**/assets/img/icons/index.json", route => route.fulfill({ status: 503 }));
  await page.goto("/directory.html");
  await expectServiceOrder(page, examples.toReversed());
  await expect(page.locator(".directoryData img.service-icon")).toHaveCount(0);
  await page.getByLabel("نام سرویس").fill("older");
  await expectServiceOrder(page, [examples[0]]);
});
