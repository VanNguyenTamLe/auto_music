console.log("run background js!");
var currentState = null;

// khoi tao se mo link đăng nhập gmail
chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    let tab = tabs[0];
    let currentURL = tab.url;
    console.log(">>>>>>>>>>>>>>currentURL: ", currentURL);
    if (!currentURL || currentURL === "chrome://newtab/" || currentURL === "chrome://new-tab-page/" || currentURL === "chrome://welcome/") {
        console.log(">>>>>>>>>>>>>>>>>>> khởi tạo");
        clearBrowserData().then(() => {
            chrome.tabs.update(undefined, { url: 'https://soundraw.io/users/sign_up' });
        })
    }
});

chrome.runtime.onMessage.addListener(function (message, sender, sendResponse) {
    if (message.sendBack) {
        console.log("log from background");
        console.log("message.request: ", message.request);

        if (message.request === "requestCardInformation") {
            getPathJsonFile('dataRegister.json').then((path) => {
                return fetch(path);
            }).then((response) => {
                return response.json();
            }).then((data) => {
                console.log(">>>>>>>>>>>>>>>>>>>>>data: ", data);
                sendResponse({ statusRequest: 0, dataRegister: data });
            })
        }
        return true;
    }
    if (message.isContent) {
        if (message.request === "requestGmailInformation") {
            getPathJsonFile('dataRegister.json').then((path) => {
                return fetch(path);
            }).then((response) => {
                return response.json();
            }).then((data) => {
                console.log(">>>>>>>>>>>>>>>>>>>>>data: ", data);
                sendResponse({ statusRequest: 0, dataGmailRegister: data });
            }).catch((err) => {
                console.log(">>>>>>>>>>>>>>>>>>>getPathJsonFile requestGmailInformation err:", err);
            });
        }


        if (message.request === 'closeBrowser') {
            console.log("close Browser");
            // Close browser
            closeBrowse().then(() => { });
        }

        if (message.request === 'checkDownload') {
            console.log("checkDownload");
            sendResponse({ statusRequest: 0, downloading: downloading });

        }

        if (message.request === 'clearCookies') {
            console.log("clearCookies");
            clearBrowserData().then(() => {
                chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                    chrome.tabs.update(undefined, { url: 'https://soundraw.io/users/sign_up' });
                });
            })

        }

        return true;
    }

    if (message.isFrame || message.isContent) {
        if (message.request === "clickButtonRegister") {
            console.log("receive message clickButtonRegister from frame");
            chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
                chrome.tabs.sendMessage(tabs[0].id, { source: "background", method: "clickButtonRegister" }, function (response) { });
            });
        }
        if (message.request === 'closeBrowser') {
            // Close browser
            closeBrowse();
        }
    }
});

let getPathJsonFile = async (jsonFileName) => {
    return chrome.runtime.getURL(jsonFileName);
}

let closeBrowse = async () => {
    chrome.tabs.query({}, function (tabs) {
        for (var i = 0; i < tabs.length; i++) {
            chrome.tabs.remove(tabs[i].id);
        }
    });
}
var downloading = 0;
chrome.downloads.onCreated.addListener(function (downloadItem) {
    downloading++;
});

chrome.downloads.onChanged.addListener(function (downloadDelta) {
    console.log("downloaded!");
    if (downloadDelta.state && downloadDelta.state.current === 'complete') {
        downloading--;
    }
});

let clearBrowserData = () => {
    return new Promise((resolve, reject) => {
        // Xóa tất cả cookies
        chrome.browsingData.removeCookies({}, () => {
            console.log('Cookies have been cleared.');
        });

        // Xóa lịch sử duyệt web
        chrome.browsingData.removeHistory({}, () => {
            console.log('Browser history has been cleared.');
        });

        resolve();
    })

}

// Lắng nghe tab đang thay đổi
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    var currentURL = tab.url;

    if (changeInfo.status === 'complete') {
        if (!currentURL || currentURL == "chrome://newtab/" || currentURL == "chrome://new-tab-page/") {
        } else {
            if (currentState !== currentURL) {
                currentState = currentURL;
                console.log(">>>> currentURL sent message: ", currentURL);
                chrome.tabs.sendMessage(tab.id, { source: "background", method: "updateURL", currentURL: currentURL }, function (response) { });
            }

        }
    }

});
