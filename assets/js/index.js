document.getElementById("copyrightyear").innerHTML = String(new Date().getFullYear())

function fetchData() {
    const DATA_URL = "https://rtbf.ir/data/data.json"

    return fetch(DATA_URL)
        .then(response => response.json())
        .catch(error => {
            console.error('There has been a problem with fetch websites data:', error)
            return null
        })
}

function appendCard(website) {
    const deleteAccountButton = `<a target="_blank" rel="nofollow" href="${website.deleteurl}" class="btn label-remove">
        <span class="fa fa-1x fa-trash"></span>
        <span>حذف حساب کاربری</span>
    </a>`

    const websiteCard = `<div class="float-right test-mohammad">
            <div class="card">
                <div class="card-body">
                    <h5 class="card-title">
                        <a target="_blank" class="text-dark" rel="nofollow" title="سایت ${website.name}" href="${website.website}">
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
                            <a class="btn text-light ${website.keytype}">${website.difficulty}</a>
                            
                            ${website.deleteurl !== '#' ? deleteAccountButton : ''}
                        </p>
                    </div>
                </div>
            </div>
          </div>`

    document.getElementsByClassName("myitems")[0]
        .insertAdjacentHTML('afterbegin', websiteCard)
}

async function appendToDOM() {
    const websites = await fetchData()

    for (const website of websites) {
        appendCard(website)
    }
}

appendToDOM()


// Close menu in mobile size on click outside
document.addEventListener("click", event => {
    const opened = document.querySelector('.navbar-collapse').classList.contains('show');

    if (opened === true && !event.target.classList.contains('navbar-toggler')) {
        document.querySelector('.navbar-toggler').click();
    }
});


function appendHeader() {
    const headerTemplate = `<div class="container menu">
        <div class="row">
            <div class="col-xl-12 col-lg-12 col-md-12 col-sm-12 col-12">
                <nav class="navbar navbar-expand-lg navbar-light bg-blur fixed-top main-menu">
                    <div class="container-fluid">
                        <button class="navbar-toggler" type="button" data-bs-toggle="collapse"
                                data-bs-target="#navbarSupportedContent" aria-controls="navbarSupportedContent"
                                aria-expanded="false" aria-label="Toggle navigation">
                            <span class="navbar-toggler-icon"></span>
                        </button>

                        <div class="collapse navbar-collapse" id="navbarSupportedContent">
                            <ul class="navbar-nav m-auto text-centerr">
                                <li class="nav-item">
                                    <a href="index" title="صفحه‌اصلی" class="nav-link active text-dark"><span
                                            class="fas fa-1x fa-home"></span> صفحه‌اصلی</a>
                                </li>
                                <li class="nav-item"><a href="collabrator" title="مشارکت‌کنندگان"
                                                        class="nav-link text-dark"><span
                                        class="fas fa-1x fa-network-wired"></span> مشارکت‌کنندگان</a>
                                </li>
                                <li class="nav-item">
                                    <a href="banners" title="بنرها" class="nav-link text-dark"><span
                                            class="fas fa-1x fa-scroll"></span> بنرها</a>
                                </li>
                                <li class="nav-item">
                                    <a href="https://anchor.fm/datatalk" target="_blank" rel="nofollow" title="پادکست"
                                       class="nav-link text-dark"><span class="fas fa-1x fa-podcast"></span> پادکست</a>
                                </li>
                                <li class="nav-item">
                                    <a href="blog" title="وبلاگ" class="nav-link text-dark"><span
                                            class="fas fa-1x fa-home"></span> وبلاگ</a>
                                </li>
                                <li class="nav-item">
                                    <a href="donate" title="حمایت مالی" class="nav-link text-dark"><span
                                            class="fas fa-1x fa-donate"></span> حمایت مالی</a>
                                </li>
                                <li class="nav-item">
                                    <a href="faq" title="سوالات متداول" class="nav-link text-dark"><span
                                            class="fas fa-1x fa-question"></span> سوالات متداول</a>
                                </li>
                            </ul>
                        </div>
                    </div>
                </nav>
            </div>
        </div>
    </div>
    <div class="header-wall">
        <div class="container heading">
            <div class="row">
                <div class="col-xl-12 col-lg-12 col-md-12 col-sm-12 col-12 text-light" dir="ltr">
                    <h1 class="d-none">حق فراموش شدن</h1>
                    <h2 class="d-none">دایرکتوری حذف حساب‌های کاربری</h2>
                    <h3 class="d-none">WWW.RTBF.ir</h3>
                    <p class="links">
                        <a target="_blank" class="btn btn-info text-light share-twitter" href="https://twitter.com/intent/tweet?text=اگر شما هم حذف حساب کاربری را دغدغه‌ی خود می‌دانید از این سرویس استفاده کنید : www.rtbf.ir - @rtbf_ir" title="توییت کنید">
                            توییت کنید <span class="fab fa-1x fa-twitter"></span>
                        </a>
                        <a target="_blank" class="btn btn-warning text-light contribute-github" href="https://github.com/rtbf-ir/rtbf.ir/issues/new/choose" title="شما هم مشارکت کنید">
                            شما هم مشارکت کنید <span class="fab fa-1x fa-github"></span>
                        </a>
                    </p>
                </div>
            </div>
        </div>
    </div>
    <div class="breadcrumb">
        <div class="container">
            <div class="row">
                <div class="col-xl-12 col-lg-12 col-md-12 col-sm-12 col-12">
                    <nav class="navbar">
                        <ul class="nav">
                            <li class="nav-item"><a class="nav-link" href="index">حق فراموش شدن</a></li>
                            <li class="nav-item"><a class="nav-link" href="#">صفحه‌اصلی</a></li>
                        </ul>
                    </nav>
                </div>
            </div>
        </div>
    </div>`

    document.getElementById('header')
        .insertAdjacentHTML('afterbegin', headerTemplate)
}

appendHeader()
