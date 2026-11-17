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
const directoryRetry = document.getElementById("directory-retry");
const directoryReset = document.getElementById("directory-reset");
const directorySearch = document.getElementById("servicename");
const directorySort = document.getElementById("directory-sort");
const directoryFilters = {
  category: document.getElementById("category"),
  priority: document.getElementById("priority"),
  status: document.getElementById("status"),
};
let directoryItems;

function appendCard(website) {
  const serviceName = website.name
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const deleteLabel = "حذف حساب‌کاربری";
  const deleteAccountButton = `<a target="_blank" rel="nofollow noreferrer noopener" href="https://${website.deleteurl}" class="btn label-remove" aria-label="${deleteLabel} ${serviceName}">
        <span class="fa fa-1x fa-trash" aria-hidden="true"></span>
        <span>${deleteLabel}</span>
    </a>`;

  const websiteCard = `<div class="float-right test-mohammad">
            <div class="card">
                <div class="card-body d-flex flex-column">
                    <h5 class="card-title">
                        <a target="_blank" class="text-dark" rel="nofollow noreferrer noopener" title="سایت ${serviceName}" href="https://${website.website}">
                            ${serviceName}
                        </a>
                        <a href="https://github.com/rtbf-ir/rtbf.ir/issues/new/choose"
                            style="font-size:12px;"
                            class="text-warning" title="اطلاعات این بخش اشتباه است قصد اصلاح دارم"
                            aria-label="تصحیح اطلاعات ${serviceName}">
                            <small>
                                <span class="fas fa-1x fa-bolt" aria-hidden="true"></span>
                                تصحیح
                            </small>
                        </a>
                    </h5>

                    <p class="card-text"><small>${website.info}</small></p>

                    <div class="card-opt mt-auto">
                        <span class="btn text-light ${website.keytype}">${website.difficulty}</span>
                        ${website.deleteurl === "#" ? "" : deleteAccountButton}
                    </div>
                </div>
            </div>
          </div>`;

  directoryResults.insertAdjacentHTML("beforeend", websiteCard);
}

async function loadDirectory() {
  const retryHadFocus = document.activeElement === directoryRetry;
  directoryStatus.textContent = "در حال بارگذاری فهرست سرویس‌ها…";
  directoryRetry.hidden = true;
  directoryRetry.disabled = true;

  try {
    const response = await fetch("./data/data.json");
    if (!response.ok) {
      throw new Error("Directory request failed with HTTP " + response.status);
    }

    const items = await response.json();
    if (!Array.isArray(items) || !items.every(
      (item) => typeof item?.name === "string" && typeof item?.website === "string"
    )) {
      throw new Error("Invalid directory data");
    }
    directoryItems = items;
  } catch (error) {
    console.error("Could not load directory data:", error);
    directoryStatus.textContent = "بارگذاری فهرست سرویس‌ها ناموفق بود.";
    directoryRetry.hidden = false;
    directoryRetry.disabled = false;
    if (retryHadFocus && document.activeElement === document.body) {
      directoryRetry.focus();
    }
    return;
  }

  filterData();
  if (retryHadFocus && document.activeElement === document.body) {
    directoryStatus.focus();
  }
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
}

function restoreFilters() {
  const params = new URLSearchParams(window.location.hash.slice(1));
  applyFilterParams(params);
  directorySort.value = params.get("sort") === "oldest" ? "oldest" : "newest";
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
  if (directorySort.value === "oldest") params.set("sort", "oldest");

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
  const hasActiveFilters = Object.values(directoryFilters).some((select) => select.value !== "all");
  directoryReset.hidden = !query && !hasActiveFilters;

  if (!directoryItems) return;

  const items = directoryItems.filter(
    (item) =>
      (category.value === "all" || item.category === category.value) &&
      (priority.value === "all" || item.priority === priority.value) &&
      (status.value === "all" || item.keytype === status.value) &&
      (!query ||
        normalizeSearchText(item.name).includes(query) ||
        normalizeSearchText(item.website).includes(query))
  );

  // Records are added to the end of data.json.
  if (directorySort.value === "newest") items.reverse();

  directoryResults.textContent = "";
  for (const item of items) {
    appendCard(item);
  }

  directoryStatus.textContent = items.length
    ? toPersianNumber(items.length) + " نتیجه"
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
directorySort.addEventListener("change", updateFilters);
for (const select of Object.values(directoryFilters)) {
  select.addEventListener("change", updateFilters);
}
directoryReset.addEventListener("click", (event) => {
  applyFilterParams(new URLSearchParams());
  if (event.detail === 0) directorySearch.focus();
  updateFilters();
});
directoryRetry.addEventListener("click", loadDirectory);
window.addEventListener("hashchange", restoreFilters);

restoreFilters();
loadDirectory();
