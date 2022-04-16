function readTextFile(callback) {
    const DATA_URL = "https://rtbf.ir/data/data.json"
    let a = new XMLHttpRequest()
    a.overrideMimeType("application/json")
    a.open("GET", DATA_URL, !0)
    a.onreadystatechange = function () {
        4 === a.readyState && a.status == "200" && callback(a.responseText)
    }
    a.send(null)
}

document.getElementById("copyrightyear").innerHTML = String(new Date().getFullYear())

readTextFile(function (e) {
    const websites = JSON.parse(e)
    const sortedData = websites.sort((a, b) => b.name.localeCompare(a.name))

    for (let a = sortedData.length - 1; a >= 0; a--) {
        sortedData[a].deleteurl === "#"
            ? $(".myitems").append(
                '<div class="float-right"><div class="card"><div class="card-body"><h5 class="card-title"><a target="_blank" class="text-dark" rel="nofollow" title="سایت ' +
                sortedData[a].name +
                '" href="' +
                sortedData[a].website +
                '">' +
                sortedData[a].name +
                '</a>&nbsp;<a href="https://github.com/amirshnll/rtbf.ir/issues/new/choose" style="font-size:12px;" class="text-warning" title="اطلاعات این بخش اشتباه است قصد اصلاح دارم"><small><span class="fas fa-1x fa-bolt"></span> تصحیح<small></a></h5><p class="card-text">' +
                sortedData[a].info +
                '</p><div class="gap-card"></div><div><p class="card-opt"><a class="btn text-light ' +
                sortedData[a].keytype +
                '">' +
                sortedData[a].difficulty +
                "</a></p></div></div></div></div>"
            )
            : $(".myitems").append(
                '<div class="float-right"><div class="card"><div class="card-body"><h5 class="card-title"><a target="_blank" class="text-dark" rel="nofollow" title="سایت ' +
                sortedData[a].name +
                '" href="' +
                sortedData[a].website +
                '">' +
                sortedData[a].name +
                '</a>&nbsp;<a href="https://github.com/amirshnll/rtbf.ir/issues/new/choose" style="font-size:12px;" class="text-warning" title="اطلاعات این بخش اشتباه است قصد اصلاح دارم"><small><span class="fas fa-1x fa-bolt"></span> تصحیح<small></a></h5><p class="card-text">' +
                sortedData[a].info +
                '</p><div class="gap-card"></div><div><p class="card-opt"><a class="btn text-light ' +
                sortedData[a].keytype +
                '">' +
                sortedData[a].difficulty +
                '</a>&nbsp;<a target="_blank" rel="nofollow" href="' +
                sortedData[a].deleteurl +
                '" class="btn label-remove"><span class="fa fa-1x fa-trash"></span> &nbsp;حذف حساب کاربری</a></p></div></div></div></div>'
            );
    }

    $(".myitems").append(
        '<div class="float-right"><a class="text-light" href="https://rtbf.ir/issue" title="افزودن سایت/سرویس به لیست"><div class="card bg-success text-light text-center"><div class="card-body"><span class="display-1 plus-service">+</span></div></a></div>'
    );
});
