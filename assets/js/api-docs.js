import { createClient } from "../../api/v1/client.js";

const apiBase = new URL("../../api/v1/", import.meta.url);
const client = createClient({ baseURL: apiBase });
const lookupForm = document.getElementById("api-lookup");
const lookupStatus = document.getElementById("api-lookup-status");
const lookupOutput = document.getElementById("api-lookup-response");
const listForm = document.getElementById("api-list");
const listStatus = document.getElementById("api-list-status");
const listOutput = document.getElementById("api-list-response");
const endpointLink = document.getElementById("api-list-url");
const previous = document.getElementById("api-previous");
const next = document.getElementById("api-next");
const submitList = listForm.querySelector('button[type="submit"]');
let page = 1;
let loading = false;

lookupForm.addEventListener("submit", async event => {
  event.preventDefault();
  const submit = lookupForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  lookupStatus.textContent = "در حال بررسی…";
  lookupOutput.textContent = "";
  try {
    const result = await client.lookup(document.getElementById("api-input-url").value);
    lookupOutput.textContent = JSON.stringify(result, null, 2);
    lookupStatus.textContent = result.data ? "سرویس پیدا شد." : "این دامنه در دایرکتوری ثبت نشده است.";
  } catch {
    lookupStatus.textContent = "بررسی انجام نشد. نشانی و اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.";
  } finally {
    submit.disabled = false;
  }
});

async function showList(number) {
  if (loading) return;
  loading = true;
  previous.disabled = true;
  next.disabled = true;
  submitList.disabled = true;
  listStatus.textContent = "در حال دریافت فهرست…";
  const values = new FormData(listForm);
  for (const select of listForm.querySelectorAll("select")) select.disabled = true;
  const segments = ["category", "status", "priority", "sort"].map(key => encodeURIComponent(values.get(key)));
  const url = new URL("directory/" + segments.join("/") + "/" + number + ".json", apiBase);
  endpointLink.href = url;
  endpointLink.textContent = url.href;
  endpointLink.hidden = false;
  listOutput.textContent = "";
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("HTTP " + response.status);
    const result = await response.json();
    page = result.meta.page;
    listOutput.textContent = JSON.stringify(result, null, 2);
    const persian = value => value.toLocaleString("fa-IR");
    listStatus.textContent = persian(result.meta.total) + " سرویس، صفحهٔ " +
      persian(page) + " از " + persian(result.meta.total_pages);
    previous.disabled = !result.links.previous;
    next.disabled = !result.links.next;
  } catch {
    listStatus.textContent = "دریافت فهرست ناموفق بود. با دکمهٔ دریافت دوباره تلاش کنید.";
  } finally {
    loading = false;
    submitList.disabled = false;
    for (const select of listForm.querySelectorAll("select")) select.disabled = false;
  }
}

listForm.addEventListener("submit", event => {
  event.preventDefault();
  showList(1);
});
listForm.addEventListener("change", () => {
  previous.disabled = true;
  next.disabled = true;
});
previous.addEventListener("click", () => showList(page - 1));
next.addEventListener("click", () => showList(page + 1));

async function loadCategories() {
  const select = document.getElementById("api-category");
  const response = await fetch(new URL("index.json", apiBase));
  if (!response.ok) throw new Error("Could not load API metadata.");
  const metadata = await response.json();
  for (const category of metadata.filters.category.filter(value => value !== "all")) {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    select.append(option);
  }
}

loadCategories().catch(() => {
  listStatus.textContent = "فهرست دسته‌بندی‌ها دریافت نشد. صفحه را دوباره بارگذاری کنید.";
});
