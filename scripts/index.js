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
                        <a href="https://github.com/amirshnll/rtbf.ir/issues/new/choose"
                            style="font-size:12px;"
                            class="text-warning" title="اطلاعات این بخش اشتباه است قصد اصلاح دارم">
                                <small>
                                    <span class="fas fa-1x fa-bolt"></span>
                                تصحیح<small>
                        </a>
                    </h5>

                    <p class="card-text"><small>${website.info}</small></p>

                    <div class="gap-card"></div>

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
    const sortedAlphabetically = websites.sort((a, b) => a.name.localeCompare(b.name))

    for (const website of sortedAlphabetically) {
        appendCard(website)
    }
}

appendToDOM()
