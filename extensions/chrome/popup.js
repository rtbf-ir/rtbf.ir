const DATA_URL = 'https://raw.githubusercontent.com/amirshnll/rtbf.ir/main/data/data.json';

const DIFFICULTY_COLORS = {
    "impossible-label": "#000000",
    "hard-label": "#a32100",
    "easy-label": "#129141",
    "medium-label": "#ffa800"
}

const DIFFICULTY_IMAGES = {
    "impossible-label": '/assets/images/d_impossible_logo.png',
    "hard-label": '/assets/images/d_hard_logo.png',
    "easy-label": '/assets/images/d_easy_logo.png',
    "medium-label": '/assets/images/d_medium_logo.png',
}

function changeIcon(difficulty, tabId) {
    chrome.action.setIcon({path: DIFFICULTY_IMAGES[difficulty], tabId})
}

function hideSpinner(){
    document.querySelector('.spinner-container').style.display = 'none'
}

function showDifficulty(item, tabId) {
    const {difficulty: difficultyLabel, keytype: difficulty, info} = item

    changeIcon(difficulty, tabId)

    document.querySelector('.difficulty-text').innerText = difficultyLabel
    document.querySelector('.difficulty-text').style.backgroundColor = DIFFICULTY_COLORS[difficulty]
    document.querySelector('.difficulty-info')
        .insertAdjacentHTML('afterbegin', info);

    hideSpinner()

    document.querySelector('.difficulty-container').style.display = 'flex'
}

function showNotSupported() {
    hideSpinner()
    document.querySelector('.not-supported-container').style.display = 'block'
}

chrome?.tabs?.query({
    active: true,
    lastFocusedWindow: true
}, function (tabs) {
    const currentUrl = tabs[0].url;
    const tabId = tabs[0].id;

    fetch(DATA_URL)
        .then((response) => response.json())
        .then((websites) => {
            for (let item of websites) {
                if (item.website.includes(currentUrl)) {
                    showDifficulty(item, tabId);
                    return;
                }
            }

            showNotSupported();
        });
});

