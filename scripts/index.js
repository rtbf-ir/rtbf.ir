document.getElementById("copyrightyear").innerHTML = String(new Date().getFullYear());

async function postData() {
    const DATA_URL = "https://rtbf.ir/data/data.json"

    return fetch(DATA_URL)
        .then(response => response.json())
        .catch(error => {
            console.error('There has been a problem with fetch websites data:', error)
            return null
        })
}

function appendCard(website) {
    $(".myitems").append(
        '<div class="float-right"><div class="card"><div class="card-body"><h5 class="card-title"><a target="_blank" class="text-dark" rel="nofollow" title="سایت ' +
        website.name +
        '" href="' +
        website.website +
        '">' +
        website.name +
        '</a>&nbsp;<a href="https://github.com/amirshnll/rtbf.ir/issues/new/choose" style="font-size:12px;" class="text-warning" title="اطلاعات این بخش اشتباه است قصد اصلاح دارم"><small><span class="fas fa-1x fa-bolt"></span> تصحیح<small></a></h5><p class="card-text">' +
        website.info +
        '</p><div class="gap-card"></div><div><p class="card-opt"><a class="btn text-light ' +
        website.keytype +
        '">' +
        website.difficulty +
        "</a></p></div></div></div></div>"
    );
}

function appendCardWithRemoveButton(website) {
    $(".myitems").append(
        '<div class="float-right"><div class="card"><div class="card-body"><h5 class="card-title"><a target="_blank" class="text-dark" rel="nofollow" title="سایت ' +
        website.name +
        '" href="' +
        website.website +
        '">' +
        website.name +
        '</a>&nbsp;<a href="https://github.com/amirshnll/rtbf.ir/issues/new/choose" style="font-size:12px;" class="text-warning" title="اطلاعات این بخش اشتباه است قصد اصلاح دارم"><small><span class="fas fa-1x fa-bolt"></span> تصحیح<small></a></h5><p class="card-text">' +
        website.info +
        '</p><div class="gap-card"></div><div><p class="card-opt"><a class="btn text-light ' +
        website.keytype +
        '">' +
        website.difficulty +
        '</a>&nbsp;<a target="_blank" rel="nofollow" href="' +
        website.deleteurl +
        '" class="btn label-remove"><span class="fa fa-1x fa-trash"></span> &nbsp;حذف حساب کاربری</a></p></div></div></div></div>'
    );
}

function addNewWebsiteButton() {
    document.getElementsByClassName("myitems")[0]
        .insertAdjacentHTML('beforeend',
            `<div class="float-right">
                     <a class="text-light" href="https://rtbf.ir/issue" title="افزودن سایت/سرویس به لیست">
                        <div class="card bg-success text-light text-center">
                            <div class="card-body d-flex justify-content-center align-items-center">
                                <span class="fas fa-1x fa-plus plus-service">
                            </div>
                        </div>
                     </a>
                   </div>`)
}

async function appendToDOM() {
    const websites = await postData()
    const sortedData =  websites.sort((a, b) => b.name.localeCompare(a.name))
    const websitesCount = sortedData.length - 1

    for (let i = websitesCount; i >= 0; i--) {
        sortedData[i].deleteurl === "#"
            ? appendCard(sortedData[i])
            : appendCardWithRemoveButton(sortedData[i]);
    }

    addNewWebsiteButton()
}

appendToDOM()
