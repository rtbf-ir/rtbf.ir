function toPersianNumber(number) {
  const numbersMap = {
    0: "۰",
    1: "۱",
    2: "۲",
    3: "۳",
    4: "۴",
    5: "۵",
    6: "۶",
    7: "۷",
    8: "۸",
    9: "۹",
  };
  return String(number)
    .split("")
    .map((digit) => numbersMap[digit] || digit)
    .join("");
}

document.getElementById("copyrightyear").innerHTML =
  toPersianNumber(new Date().getFullYear()) + " - ۲۰۲۱";

const directoryResults = document.querySelector(".directoryData");
const directoryStatus = document.getElementById("directory-status");
const directoryReset = document.getElementById("directory-reset");
const directorySearch = document.getElementById("servicename");
const directorySort = document.getElementById("directory-sort");
const directoryFilters = {
  category: document.getElementById("category"),
  priority: document.getElementById("priority"),
  status: document.getElementById("status"),
};
const directoryItems = [...directoryResults.children].map(card => {
  const service = card.querySelector(".service-name");
  return {
    card,
    ...card.dataset,
    search: normalizeSearchText(service.textContent + " " + service.getAttribute("href")),
  };
});
let showingOldest = false;

function removeBrokenIcon(image) {
  if (image.matches("img.service-icon")) image.remove();
}

directoryResults.addEventListener("error", event => removeBrokenIcon(event.target), true);
for (const image of directoryResults.querySelectorAll("img.service-icon")) {
  if (image.complete && !image.naturalWidth) removeBrokenIcon(image);
}

// Close menu in mobile size on click outside
document.addEventListener("click", (event) => {
  const opened = document
    .querySelector(".navbar-collapse")
    .classList.contains("show");

  if (opened === true && !event.target.classList.contains("navbar-toggler")) {
    document.querySelector(".navbar-toggler").click();
  }
});

function normalizeSearchText(value) {
  return value
    .toLowerCase()
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\s\u200c]+/g, " ")
    .trim();
}

function applyFilterParams(params) {
  directorySearch.value = params.get("q") ?? "";
  for (const [key, select] of Object.entries(directoryFilters)) {
    select.value = params.get(key) ?? "all";
    if (select.selectedIndex === -1) select.value = "all";
  }
  if (directorySort) {
    directorySort.value = params.get("sort") === "oldest" ? "oldest" : "newest";
  }
}

function restoreFilters() {
  applyFilterParams(new URLSearchParams(window.location.hash.slice(1)));
  filterData();
}

function updateFilters() {
  const params = new URLSearchParams();
  if (normalizeSearchText(directorySearch.value)) {
    params.set("q", directorySearch.value);
  }
  for (const [key, select] of Object.entries(directoryFilters)) {
    if (select.value !== "all") params.set(key, select.value);
  }
  if (directorySort?.value === "oldest") params.set("sort", "oldest");

  const url = new URL(window.location.href);
  url.hash = params.toString();
  if (url.href !== window.location.href) {
    window.history.replaceState(window.history.state, "", url.href);
  }
  filterData();
}

function filterData() {
  const { category, priority, status } = directoryFilters;
  const query = normalizeSearchText(directorySearch.value);
  const sortOldest = directorySort?.value === "oldest";
  const hasActiveFilters = Object.values(directoryFilters).some((select) => select.value !== "all");
  directoryReset.hidden = !query && !hasActiveFilters && !sortOldest;

  let count = 0;
  for (const item of directoryItems) {
    const matches = (category.value === "all" || item.category === category.value) &&
      (priority.value === "all" || item.priority === priority.value) &&
      (status.value === "all" || item.status === status.value) &&
      (!query || item.search.includes(query));
    item.card.hidden = !matches;
    if (matches) count++;
  }

  // The generated HTML starts in newest-first order.
  if (sortOldest !== showingOldest) {
    const ordered = sortOldest ? [...directoryItems].reverse() : directoryItems;
    directoryResults.append(...ordered.map(item => item.card));
    showingOldest = sortOldest;
  }

  directoryStatus.textContent = count
    ? toPersianNumber(count) + " نتیجه"
    : "سرویسی پیدا نشد (۰ نتیجه).";
}

document.querySelector(".skip-link").addEventListener("click", (event) => {
  const hash = window.location.hash;
  if (
    !hash || hash === event.currentTarget.hash ||
    event.ctrlKey || event.metaKey || event.shiftKey || event.altKey
  ) {
    return;
  }

  // Keep the shareable filter fragment when jumping to the content.
  event.preventDefault();
  const main = document.getElementById("main-content");
  main.focus({ preventScroll: true });
  main.scrollIntoView();
});

directorySearch.addEventListener("input", updateFilters);
directorySort?.addEventListener("change", updateFilters);
for (const select of Object.values(directoryFilters)) {
  select.addEventListener("change", updateFilters);
}
directoryReset.addEventListener("click", (event) => {
  applyFilterParams(new URLSearchParams());
  if (event.detail === 0) directorySearch.focus();
  updateFilters();
});
window.addEventListener("hashchange", restoreFilters);

restoreFilters();
document.getElementById("directory-controls").hidden = false;
