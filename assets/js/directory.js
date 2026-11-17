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
const directoryFilters = {
  category: document.getElementById("category"),
  priority: document.getElementById("priority"),
  status: document.getElementById("status"),
};
let directoryItems;

function appendCard(website) {
  const deleteAccountButton = `<a target="_blank" rel="nofollow noreferrer noopener" href="https://${website.deleteurl}" class="btn label-remove">
        <span class="fa fa-1x fa-trash"></span>
        <span>حذف حساب‌کاربری</span>
    </a>`;

  const websiteCard = `<div class="float-right test-mohammad">
            <div class="card">
                <div class="card-body">
                    <h5 class="card-title">
                        <a target="_blank" class="text-dark" rel="nofollow noreferrer noopener" title="سایت ${
                          website.name
                        }" href="https://${website.website}">
                            ${website.name}
                        </a>
                        <a href="https://github.com/rtbf-ir/rtbf.ir/issues/new/choose"
                            style="font-size:12px;"
                            class="text-warning" title="اطلاعات این بخش اشتباه است قصد اصلاح دارم">
                                <small>
                                    <span class="fas fa-1x fa-bolt"></span>
                                تصحیح<small>
                        </a>
                    </h5>

                    <p class="card-text"><small>${website.info}</small></p>

                    <div>
                        <p class="card-opt">
                            <a class="btn text-light ${website.keytype}">${
    website.difficulty
  }</a>
                            
                            ${
                              website.deleteurl !== "#"
                                ? deleteAccountButton
                                : ""
                            }
                        </p>
                    </div>
                </div>
            </div>
          </div>`;

  directoryResults.insertAdjacentHTML("afterbegin", websiteCard);
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

  const url = new URL(window.location.href);
  url.hash = params.toString();
  if (url.href !== window.location.href) {
    window.history.replaceState(window.history.state, "", url.href);
  }
  filterData();
}

function filterData() {
  if (!directoryItems) return;

  const { category, priority, status } = directoryFilters;
  const query = normalizeSearchText(directorySearch.value);

  const items = directoryItems.filter(
    (item) =>
      (category.value === "all" || item.category === category.value) &&
      (priority.value === "all" || item.priority === priority.value) &&
      (status.value === "all" || item.keytype === status.value) &&
      (!query ||
        normalizeSearchText(item.name).includes(query) ||
        normalizeSearchText(item.website).includes(query))
  );

  directoryResults.textContent = "";
  for (const item of items) {
    appendCard(item);
  }

  directoryStatus.textContent = items.length
    ? toPersianNumber(items.length) + " نتیجه"
    : "سرویسی پیدا نشد (۰ نتیجه).";
}

directorySearch.addEventListener("input", updateFilters);
for (const select of Object.values(directoryFilters)) {
  select.addEventListener("change", updateFilters);
}
directoryReset.addEventListener("click", () => {
  applyFilterParams(new URLSearchParams());
  updateFilters();
});
directoryRetry.addEventListener("click", loadDirectory);
window.addEventListener("hashchange", restoreFilters);

restoreFilters();
loadDirectory();
