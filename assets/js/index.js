document.getElementById("copyrightyear").innerHTML = String(
  new Date().getFullYear()
);

async function fetchData() {
  const DATA_URL = "https://rtbf.ir/data/data.json";

  try {
    const response = await fetch(DATA_URL);
    const result = await response.json();
    document.getElementById("jsondata").value = JSON.stringify(result);
    return await result;
  } catch (error) {
    console.error("There has been a problem with fetch websites data:", error);
    return null;
  }
}

function appendCard(website) {
  const deleteAccountButton = `<a target="_blank" rel="nofollow" href="${website.deleteurl}" class="btn label-remove">
        <span class="fa fa-1x fa-trash"></span>
        <span>حذف حساب کاربری</span>
    </a>`;

  const websiteCard = `<div class="float-right test-mohammad">
            <div class="card">
                <div class="card-body">
                    <h5 class="card-title">
                        <a target="_blank" class="text-dark" rel="nofollow" title="سایت ${
                          website.name
                        }" href="${website.website}">
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

  document
    .getElementsByClassName("directoryData")[0]
    .insertAdjacentHTML("afterbegin", websiteCard);
}

async function appendToDOMAll() {
  const items = await fetchData();
  document.getElementsByClassName("directoryData")[0].innerHTML = "";
  for (const item of items) {
    appendCard(item);
  }
}

appendToDOMAll();

// Close menu in mobile size on click outside
document.addEventListener("click", (event) => {
  const opened = document
    .querySelector(".navbar-collapse")
    .classList.contains("show");

  if (opened === true && !event.target.classList.contains("navbar-toggler")) {
    document.querySelector(".navbar-toggler").click();
  }
});

function filterData() {
  var categoryDom = document.getElementById("category");
  var priorityDom = document.getElementById("priority");
  var statusDom = document.getElementById("status");
  var serviceNameDom = document.getElementById("servicename");
  try {
    changeData(
      categoryDom.value,
      priorityDom.value,
      statusDom.value,
      serviceNameDom.value
    );
  } catch (err) {
    appendToDOMAll();
  }
}

async function changeData(category, priority, status, service_name) {
  var items = "";

  try {
    jsondata = document.getElementById("jsondata").value;
    var items = JSON.parse(jsondata);
    if (items.length < 1) {
      items = await fetchData();
    }
  } catch (err) {
    items = await fetchData();
  }

  var filtered = [];

  if (category != "all") {
    for (let index = 0; index < items.length; index++) {
      const element = items[index];
      if (element["category"] == category) {
        filtered.push(element);
      }
    }
    items = filtered;
    filtered = [];
  }

  if (priority != "all") {
    for (let index = 0; index < items.length; index++) {
      const element = items[index];
      if (element["priority"] == priority) {
        filtered.push(element);
      }
    }
    items = filtered;
    filtered = [];
  }

  if (status != "all") {
    for (let index = 0; index < items.length; index++) {
      const element = items[index];
      if (element["keytype"] == status) {
        filtered.push(element);
      }
    }
    items = filtered;
    filtered = [];
  }

  service_name = service_name;
  if (service_name != "") {
    for (let index = 0; index < items.length; index++) {
      const element = items[index];
      if (element["name"].search(service_name) != -1) {
        filtered.push(element);
      }
    }
    items = filtered;
    filtered = [];
  }

  document.getElementsByClassName("directoryData")[0].innerHTML = "";

  for (const item of items) {
    appendCard(item);
  }
}
