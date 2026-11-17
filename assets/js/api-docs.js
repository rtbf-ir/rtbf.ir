const apiBase = new URL("../../api/v1/", import.meta.url);
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
let previousPath;
let nextPath;
let loading = false;

async function request(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("HTTP " + response.status);
  return response.json();
}

lookupForm.addEventListener("submit", async event => {
  event.preventDefault();
  const submit = lookupForm.querySelector('button[type="submit"]');
  submit.disabled = true;
  lookupStatus.textContent = "در حال بررسی…";
  lookupOutput.textContent = "";
  try {
    const input = document.getElementById("api-input-url").value.trim();
    const url = new URL(input.startsWith("//") ? "https:" + input :
      /^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : "https://" + input);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new Error("Invalid URL");
    const domain = url.hostname.toLowerCase().replace(/\.$/, "").replace(/^www\./, "");
    const response = await fetch(new URL("services/" + encodeURIComponent(domain), apiBase));
    if (response.status === 404) {
      lookupStatus.textContent = "این دامنه در دایرکتوری ثبت نشده است.";
      return;
    }
    if (!response.ok) throw new Error("HTTP " + response.status);
    lookupOutput.textContent = JSON.stringify(await response.json(), null, 2);
    lookupStatus.textContent = "سرویس پیدا شد.";
  } catch {
    lookupStatus.textContent = "بررسی انجام نشد. نشانی و اتصال اینترنت را بررسی کنید و دوباره تلاش کنید.";
  } finally {
    submit.disabled = false;
  }
});

async function showList(path) {
  if (loading) return;
  loading = true;
  previous.disabled = next.disabled = submitList.disabled = true;
  for (const select of listForm.querySelectorAll("select")) select.disabled = true;
  listStatus.textContent = "در حال دریافت فهرست…";
  const url = new URL(path, apiBase);
  endpointLink.href = url;
  endpointLink.textContent = url.href;
  endpointLink.hidden = false;
  listOutput.textContent = "";
  try {
    const result = await request(url);
    listOutput.textContent = JSON.stringify(result, null, 2);
    const persian = value => value.toLocaleString("fa-IR");
    listStatus.textContent = persian(result.meta.total) + " سرویس، صفحهٔ " +
      persian(result.meta.page) + " از " + persian(result.meta.total_pages);
    previousPath = result.links.previous;
    nextPath = result.links.next;
    previous.disabled = !previousPath;
    next.disabled = !nextPath;
  } catch {
    previousPath = nextPath = null;
    listStatus.textContent = "دریافت فهرست ناموفق بود. با دکمهٔ دریافت دوباره تلاش کنید.";
  } finally {
    loading = false;
    submitList.disabled = false;
    for (const select of listForm.querySelectorAll("select")) select.disabled = false;
  }
}

listForm.addEventListener("submit", event => {
  event.preventDefault();
  const values = new FormData(listForm);
  const filters = ["category", "priority", "status", "sort"]
    .map(key => key + "=" + encodeURIComponent(values.get(key))).join("&");
  showList("services/" + filters);
});
listForm.addEventListener("change", () => { previous.disabled = next.disabled = true; });
previous.addEventListener("click", () => { if (previousPath) showList(previousPath); });
next.addEventListener("click", () => { if (nextPath) showList(nextPath); });

request(apiBase).then(metadata => {
  const select = document.getElementById("api-category");
  for (const category of metadata.filters.category.filter(value => value !== "all")) {
    const option = document.createElement("option");
    option.value = option.textContent = category;
    select.append(option);
  }
}).catch(() => {
  listStatus.textContent = "فهرست دسته‌بندی‌ها دریافت نشد. صفحه را دوباره بارگذاری کنید.";
});
