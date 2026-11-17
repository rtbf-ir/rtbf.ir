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
    return;
  }

  filterData();
}

directoryRetry.addEventListener("click", loadDirectory);
loadDirectory();

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

function filterData() {
  if (!directoryItems) return;

  const category = document.getElementById("category").value.toLowerCase();
  const priority = document.getElementById("priority").value.toLowerCase();
  const status = document.getElementById("status").value.toLowerCase();
  const query = normalizeSearchText(document.getElementById("servicename").value);

  const items = directoryItems.filter(
    (item) =>
      (category === "all" || item.category === category) &&
      (priority === "all" || item.priority === priority) &&
      (status === "all" || item.keytype === status) &&
      (!query ||
        normalizeSearchText(item.name).includes(query) ||
        normalizeSearchText(item.website).includes(query))
  );

  directoryResults.textContent = "";
  for (const item of items) {
    appendCard(item);
  }

  directoryStatus.textContent = items.length ? "" : "سرویسی پیدا نشد.";
}
