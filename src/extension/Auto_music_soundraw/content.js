var isTop = true;
const delayTime = ms => new Promise(res => setTimeout(res, ms));


var isFetchDataGmail = false;
var dataRegister = {
    usernameGmail: "",
    passwordGmail: ""
}

let videoToView = {
    videoId: 0,
    videoKeySearch: "",
    videoLink: "",
    videoName: "",
    chanel: ""
};

let socket;

if (!isFetchDataGmail || dataRegister.usernameGmail === "") {
    let requestContent = "requestGmailInformation";
    chrome.runtime.sendMessage({ isContent: true, request: requestContent }, function (response) {
        if (response.statusRequest === 0) {
            let dataGmail = response.dataGmailRegister;
            dataRegister.usernameGmail = dataGmail.gmailAccount.usernameGmail;
            dataRegister.passwordGmail = dataGmail.gmailAccount.passwordGmail;
            isFetchDataGmail = true;
            socket = io("http://localhost:8081", { transports: ['websocket'] });
            socket.emit("createRoomAccountView", dataRegister.usernameGmail);
        }
    })
}

let getDataRegister = async () => {
    if (dataRegister.usernameGmail === "") {
        let requestContent = "requestGmailInformation";
        let response = await chrome.runtime.sendMessage({ isContent: true, request: requestContent });
        if (response.statusRequest === 0) {
            let dataGmail = response.dataGmailRegister;
            dataRegister.usernameGmail = dataGmail.gmailAccount.usernameGmail;
            dataRegister.passwordGmail = dataGmail.gmailAccount.passwordGmail;
            isFetchDataGmail = true;
            socket = io("http://localhost:8081", { transports: ['websocket'] });
            socket.emit("createRoomAccountView", dataRegister.usernameGmail);
        }
    }
    return true;
}

let getElementByXpath = async (xpath) => {
    return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}

let waitElementBaseXpath = async (xPathElement, elementName) => {
    let element = await getElementByXpath(xPathElement);
    let timeoutWaitElement = 20;
    while (element === null) {
        element = await getElementByXpath(xPathElement);
        if (timeoutWaitElement === 0) {
            return false;
        }
        await delayTime(1000);
        timeoutWaitElement--;
    }
    return true;
}

// Hàm send log html về server
let requestCaptureHtml = (titleLog) => {
    return new Promise((resolve, reject) => {
        let htmlString = new XMLSerializer().serializeToString(document)
        socket.emit('captureHtml', { titleLog: titleLog, htmlString: htmlString });
        resolve();
    })

}

let getElementBySelector = (selector) => {
    return document.querySelector(selector);
}

let waitElementBySelector = async (selector, elementName) => {
    let element = getElementBySelector(selector);
    let timeoutWaitElement = 10;
    while (element === null) {
        element = await getElementBySelector(selector);
        if (timeoutWaitElement === 0) {
            return false;
        }
        await delayTime(1000);
        timeoutWaitElement--;
    }
    return true;
}

async function loopType(n, elm, EVENTS, textString) {
    const temp = (textString + "")?.split();
    elm.value = elm.value + temp[n];
    elm.dispatchEvent(EVENTS.INPUT);
    if (++n < temp.length) {
        await delayTime(200);
        await loopType(n, elm, EVENTS, temp);
    }
    return true;
}

let typeOneByOneSimulatorContent = async (elm, textString) => {
    let EVENT_OPTIONS = { bubbles: true, cancelable: false, composed: true };
    let EVENTS = {
        BLUR: new Event("blur", EVENT_OPTIONS),
        CHANGE: new Event("change", EVENT_OPTIONS),
        INPUT: new Event("input", EVENT_OPTIONS),
    };
    elm.value = "";
    if (await loopType(0, elm, EVENTS, textString)) {
        return true;
    } else {
        return false;
    }
}



// Màn hình đăng nhập gg
let typeGmailAccount = (dataRegister, url) => {
    return new Promise(async (resolve, reject) => {
        //Nhập email
        let userNameSelector = 'input[type="email"]';
        if (await waitElementBySelector(userNameSelector, "UserName selector")) {
            let userNameElement = await getElementBySelector(userNameSelector);
            await typeOneByOneSimulatorContent(userNameElement, dataRegister.usernameGmail);
            await delayTime(500);
            await socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: "type account gmail", url: url });
            resolve();
        } else {
            // Nếu không tồn tại element thì capture html gửi server
            await socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: "không tìm thấy input username gg", url: url });
            await requestCaptureHtml("notFoundInputGmailUser");
            reject();
        }
    })
}

let clickButtonNextFormGoogleLogin = async (url) => {
    let btnNextXpath = "//button[.//*[contains(text(), 'Next') or contains(text(), 'Tiếp')]]";
    if (await waitElementBaseXpath(btnNextXpath, "btnNextAfterInputUsername")) {
        let btnNext = await getElementByXpath(btnNextXpath);
        await btnNext.click();
        // btnNext.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: false, composed: true }));
        // btnNext.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: false, composed: true }));
        // await btnNext.dispatchEvent(new Event('click', { bubbles: true, cancelable: false, composed: true }));
        await socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: "click button next gmail", url: url });
        return true;
    } else {
        // Nếu không tồn tại element thì capture html gửi server
        await socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: "không tìm thấy button next gg", url: url });
        await requestCaptureHtml("notFoundButtonNextGG");
        return false;
    }
}

let isLoadedPagePassword = async (valueLocalStore) => {

    if (localStorage.getItem(valueLocalStore) === "true") {
        return true;
    } else {
        return false;
    }
}

let waitLoadPage = async () => {

    while (/complete|interactive|loaded/.test(document.readyState) === false) {
        await delayTime(1000);
    }
    return true;
}

let typeGmailPassword = async (dataRegister, url) => {
    // Nhập pass
    await delayTime(3000);
    let passwordSelector = 'input[type="password"]';
    if (await waitElementBySelector(passwordSelector, "Password selector")) {
        let passwordElement = await getElementBySelector(passwordSelector);
        await typeOneByOneSimulatorContent(passwordElement, dataRegister.passwordGmail);
        await delayTime(3000);
        await socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: "type password gg", url: url });
        return true;
    } else {
        // Không tìm thây element
        await socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: "không tìm thấy input password gg", url: url });
        requestCaptureHtml("notFoundInputGmailPassword").then(() => { });
        return false;
    }
}

let typePasswordWithWhile = async (dataRegister, url) => {
    let passwordSelector = 'input[type="password"]';
    // if (await waitElementBySelector(passwordSelector, "Password selector")) {
    let passwordElement = await getElementBySelector(passwordSelector);
    waitLoadPage().then((rsWaitPage) => {
        if (rsWaitPage) {
            socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: "nhập password gg", url: url });
            return typeGmailPassword(dataRegister, url);
        }
    }).then((resultTypePassword) => {
        if (resultTypePassword) {
            // Nhấn button Next
            return clickButtonNextFormGoogleLogin(url);
        } else {
            // Lỗi nhập password, capture HTML
            socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: "Lỗi nhập password gg", url: url });
            requestCaptureHtml("errorInputGmailPassword").then(() => { });
        }
    }).then((reClickButtonNext) => {
        if (reClickButtonNext) {
            localStorage.setItem("isLoadPasswordPage", "true");
            // click thành công
        } else {
            // lỗi, capture HTML send to server
            requestCaptureHtml("BtnNextAfterInputGmailPassword").then(() => { });
        }
    });
    await delayTime(2000);
    if (await getElementBySelector(passwordSelector)) {
        return true;
    } else {
        return false;
    }
}

let recheckTypepassword = async (dataRegister, url) => {
    let passwordSelector = 'input[type="password"]';
    return (await typePasswordWithWhile(dataRegister, url));
}

let settingRandomNumberVideoToView = (url) => {
    return new Promise(async (resolve, reject) => {
        // let luckyArr = [1, 2];
        // let randomNumber = luckyArr[Math.floor(Math.random() * luckyArr.length)];
        let randomNumber = 1;
        // await socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: `set random number video: ${randomNumber}`, url: url });

        // set vào localstorage
        localStorage.setItem("numberRandomVideo", randomNumber);
        resolve();
    })

}

let getVideoToView = (dataRegister, url) => {
    return new Promise(async (resolve, reject) => {
        // Gửi request về server để lấy video view
        await socket.emit("getVideoToView", dataRegister.usernameGmail);
        // socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: "Lấy video để xem", url: url });
        // Nhận response từ server
        await socket.on("videoToView", async (data) => {
            if (data.errCode === 0) {
                videoToView.videoId = data.video.id;
                videoToView.videoKeySearch = data.video.videoKeySearch;
                videoToView.videoLink = data.video.videoLink;
                videoToView.videoName = data.video.videoName;
                videoToView.chanel = data.video.chanel;

                localStorage.setItem("videoToView", JSON.stringify(videoToView));

                let videoLocalStorage = await getObjectFromLocalStorage("videoToView");

                // Lấy random số lượng video cần xem lướt và set vào localstorage
                await settingRandomNumberVideoToView(url);
                resolve(videoLocalStorage);
            } else {
                // Hết video để xem hoặc xảy ra lỗi khi get video từ server
                resolve(null);
            }
        });


    })
}

function getDisplayedElementsListByXpath(xpath) {
    return new Promise(async (resolve, reject) => {
        await delayTime(3000);
        let nodesSnapshot = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        let displayedElements = [];
        for (let i = 0; i < nodesSnapshot.snapshotLength; i++) {
            let node = nodesSnapshot.snapshotItem(i);
            if (node.offsetParent !== null) {
                displayedElements.push(node);
            }
        }
        resolve(displayedElements);
    })
}

function getDisplayedElementsBySelector(selector) {
    return new Promise((resolve, reject) => {
        let nodes = document.querySelectorAll(selector);
        let displayedElements = [];
        for (let i = 0; i < nodes.length; i++) {
            let node = nodes[i];
            if (node.offsetParent !== null) {
                displayedElements.push(node);
            }
        }
        if (displayedElements.length > 0) {
            resolve(displayedElements);
        } else {
            reject("Không có phần tử hiển thị trên màn hình");
        }
    })
}

function simulateClickByXpath(xpath) {
    return new Promise(async (resolve, reject) => {
        let element = await getDisplayedElementsListByXpath(xpath);
        if (element[0]) {
            let event = new MouseEvent('click', {
                'view': window,
                'bubbles': true,
                'cancelable': true
            });
            element[0].dispatchEvent(event);
            // element[0].click();
            resolve();
        } else {
            // Không tìm thấy xpath
            await requestCaptureHtml(`BtnSearchNotFound`);
            reject(new Error(`No element found with xpath: ${xpath}`));
        }
    });
}

function simulateInputValueBySelector(selector, textString, url) {
    return new Promise(async (resolve, reject) => {
        await delayTime(2000);
        //input[@name='search']
        // let element = document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
        let element = await getDisplayedElementsBySelector(selector);
        if (element[0]) {
            let EVENT_OPTIONS = { bubbles: true, cancelable: false, composed: true };
            let EVENTS = {
                BLUR: new Event("blur", EVENT_OPTIONS),
                CHANGE: new Event("change", EVENT_OPTIONS),
                INPUT: new Event("input", EVENT_OPTIONS),
            };
            await delayTime(1000);
            element[0].value = textString;
            element[0].dispatchEvent(EVENTS.INPUT);
            resolve();
        } else {
            socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: `không tìm thấy selector ${selector}`, url: url });
            await requestCaptureHtml(`selectornotFound`);
            reject(new Error(`No element found with selector: ${selector}`));
        }
    })
}

let backupAllCookies = () => {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ isContent: true, request: "backupCookies" }, function (response) {
            if (response.statusRequest === 0) {
                let cookies = response.cookies;
                socket.emit("backupAllCookies", { gmailAccount: dataRegister.usernameGmail, cookies: cookies });
                resolve(cookies);
            } else {
                reject("xảy ra lỗi khi backup");
            }
        });
    })
}

let getRandomVideoNotView = (elementList, keyVideo) => {
    return new Promise(async (resolve, reject) => {
        try {
            let keyVideoRandom;
            do {
                let elementRandom = await elementList[Math.floor(Math.random() * (elementList.length - 1))];
                // let elementRandom = elementList[0];
                keyVideoRandom = elementRandom.getAttribute('href').split('=')[1];
            } while (keyVideoRandom === keyVideo);
            resolve(keyVideoRandom);
        } catch (error) {
            reject(error);
        }
    })
}

let searchKeyVideoNotView = (xpath, keyVideo) => {
    return new Promise(async (resolve, reject) => {
        let element = await getDisplayedElementsListByXpath(xpath);
        getRandomVideoNotView(element, keyVideo)
            .then((keyVideoRandom) => {
                resolve(keyVideoRandom);
            }).catch((error) => {
                reject(error);
            })
    })
}

async function slowScrollToElementAndClick(element, duration, dataRegister, url) {
    return new Promise(async (resolve, reject) => {
        await delayTime(3000);
        let rect = element.getBoundingClientRect();
        let elementY = rect.top + window.scrollY;
        // let elementX = rect.left + window.scrollX;

        let startingY = window.pageYOffset;
        let diff = elementY - startingY;
        let start;
        let scrollToBottom;
        if (diff > 0) {
            scrollToBottom = true;
        } else {
            scrollToBottom = false;
        }
        let count = 0;

        // Bootstrap our animation - it will get called right before next frame shall be rendered.
        window.requestAnimationFrame(async function step(timestamp) {
            count++;
            // socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: `scrolling: ${count}`, url: url });
            if (!start) start = timestamp;
            // Elapsed milliseconds since start of scrolling.
            let time = timestamp - start;
            // Get percent of completion in range [0, 1].
            let percent = Math.min(time / duration, 1);

            // window.scrollTo(0, startingY + diff * percent);
            window.scroll({
                behavior: 'smooth',
                left: 0,
                top: startingY + diff * percent
            });

            if (scrollToBottom) {
                if (elementY <= startingY + diff * percent) {
                    socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: `Đã scroll đến element scrollToBottom, count: ${count}, elementY: ${elementY}, ${startingY + diff * percent}`, url: url });
                    let randomStoptimeWatch = Math.floor(Math.random() * (5000 - 3000 + 1)) + 3000;
                    await delayTime(randomStoptimeWatch);
                    // let event = new MouseEvent('click', {
                    //     'view': window,
                    //     'bubbles': true,
                    //     'cancelable': true
                    // });
                    // element.dispatchEvent(event);
                    element.click();
                    resolve();
                }
            } else {
                if (elementY >= startingY + diff * percent) {
                    socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: `Đã scroll đến element scrollToTop, count: ${count}, elementY: ${elementY}, ${startingY + diff * percent}`, url: url });
                    let randomStoptimeWatch = Math.floor(Math.random() * (5000 - 3000 + 1)) + 3000;
                    await delayTime(randomStoptimeWatch);
                    // let event = new MouseEvent('click', {
                    //     'view': window,
                    //     'bubbles': true,
                    //     'cancelable': true
                    // });
                    // element.dispatchEvent(event);
                    element.click();
                    resolve();
                }
            }

            let randomStoptime = Math.floor(Math.random() * (5000 - 1000 + 1)) + 1000;
            await delayTime(randomStoptime);
            // Proceed with animation as long as we wanted it to.
            if (scrollToBottom) {
                if (time < duration || elementY > startingY + diff * percent) {
                    window.requestAnimationFrame(step);
                }
            } else {
                if (time < duration || elementY < startingY + diff * percent) {
                    window.requestAnimationFrame(step);
                }
            }
        })
    })
}

async function slowScrollToElementAndClickMusic(element, duration, dataRegister, url) {
    return new Promise(async (resolve, reject) => {
        let rect = element.getBoundingClientRect();
        let elementY = rect.top + window.scrollY - 116;
        // let elementX = rect.left + window.scrollX;

        let startingY = window.pageYOffset;
        let diff = elementY - startingY;
        let start;
        let scrollToBottom;
        if (diff > 0) {
            scrollToBottom = true;
        } else {
            scrollToBottom = false;
        }
        let count = 0;

        // Bootstrap our animation - it will get called right before next frame shall be rendered.
        window.requestAnimationFrame(async function step(timestamp) {
            count++;
            // socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: `scrolling: ${count}`, url: url });
            if (!start) start = timestamp;
            // Elapsed milliseconds since start of scrolling.
            let time = timestamp - start;
            // Get percent of completion in range [0, 1].
            let percent = Math.min(time / duration, 1);

            // window.scrollTo(0, startingY + diff * percent);
            window.scroll({
                behavior: 'smooth',
                left: 0,
                top: startingY + diff * percent
            });

            if (scrollToBottom) {
                if (elementY <= startingY + diff * percent) {
                    socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: `Đã scroll đến element scrollToBottom, count: ${count}, elementY: ${elementY}, ${startingY + diff * percent}`, url: url });
                    // let event = new MouseEvent('click', {
                    //     'view': window,
                    //     'bubbles': true,
                    //     'cancelable': true
                    // });
                    // element.dispatchEvent(event);
                    element.click();
                    resolve();
                }
            } else {
                if (elementY >= startingY + diff * percent) {
                    socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: `Đã scroll đến element scrollToTop, count: ${count}, elementY: ${elementY}, ${startingY + diff * percent}`, url: url });
                    // let event = new MouseEvent('click', {
                    //     'view': window,
                    //     'bubbles': true,
                    //     'cancelable': true
                    // });
                    // element.dispatchEvent(event);
                    element.click();
                    resolve();
                }
            }

            // Proceed with animation as long as we wanted it to.
            if (window.pageYOffset + window.innerHeight >= document.documentElement.scrollHeight) {
                element.click();
                resolve();
            } else {
                if (scrollToBottom) {
                    if (time < duration || elementY > startingY + diff * percent) {
                        window.requestAnimationFrame(step);
                    }
                } else {
                    if (time < duration || elementY < startingY + diff * percent) {
                        window.requestAnimationFrame(step);
                    }
                }
            }
        })
    })
}

let checkVideoViewExistOnScreenByXpath = (xpathVideoView) => {
    return new Promise(async (resolve, reject) => {
        // Lấy element video view hiển thị trên màn hình
        let elementVideoViewList = await getDisplayedElementsListByXpath(xpathVideoView);
        if (elementVideoViewList.length === 0) {
            resolve(false);
        } else {
            resolve(true);
        }
    })
}

let getTheLastVideoOnListViewOnScreenByXpath = (xpath) => {
    return new Promise(async (resolve, reject) => {
        // Lấy tất cả element video hiển thị trên màn hình
        let elementVideoList = await getDisplayedElementsListByXpath(xpath);
        if (elementVideoList.length > 0) {
            resolve(elementVideoList[elementVideoList.length - 1]);
        } else {
            resolve(null);
        }
    })
}



async function slowScrollToElement(element, duration) {
    return new Promise(async (resolve, reject) => {
        await delayTime(3000);
        let rect = element.getBoundingClientRect();
        let elementY = rect.top + window.scrollY;
        // let elementX = rect.left + window.scrollX;

        let startingY = window.pageYOffset;
        let diff = elementY - startingY;
        let start;
        let scrollToBottom;
        if (diff > 0) {
            scrollToBottom = true;
        } else {
            scrollToBottom = false;
        }

        // Bootstrap our animation - it will get called right before next frame shall be rendered.
        window.requestAnimationFrame(async function step(timestamp) {
            if (!start) start = timestamp;
            // Elapsed milliseconds since start of scrolling.
            let time = timestamp - start;
            // Get percent of completion in range [0, 1].
            let percent = Math.min(time / duration, 1);

            // window.scrollTo(0, startingY + diff * percent);
            window.scroll({
                behavior: 'smooth',
                left: 0,
                top: startingY + diff * percent
            });

            if (scrollToBottom) {
                if (elementY <= startingY + diff * percent) {
                    resolve();
                }
            } else {
                if (elementY >= startingY + diff * percent) {
                    resolve();
                }
            }

            let randomStoptime = Math.floor(Math.random() * (5000 - 1000 + 1)) + 1000;
            await delayTime(randomStoptime);
            // Proceed with animation as long as we wanted it to.
            if (scrollToBottom) {
                if (time < duration || elementY > startingY + diff * percent) {
                    window.requestAnimationFrame(step);
                }
            } else {
                if (time < duration || elementY < startingY + diff * percent) {
                    window.requestAnimationFrame(step);
                }
            }
        })
    })
}

let slowScrollAndSearchElementAndClick = (xpathVideoView, xpathVideoList, dataRegister, url) => {
    return new Promise(async (resolve, reject) => {
        let isExist = false;
        // Kiểm tra nếu video view chưa xuất hiện trên màn hình thì cứ kéo xuống
        while (!isExist) {
            // Lấy video cuối cùng trong kết quả tìm kiếm trên màn hình
            let theLastVideoOnScreen = await getTheLastVideoOnListViewOnScreenByXpath(xpathVideoList);

            // Scroll đến video cuối cùng
            await slowScrollToElement(theLastVideoOnScreen, 10000);

            let randomStoptime = Math.floor(Math.random() * (3000 - 2000 + 1)) + 2000;
            await delayTime(randomStoptime);

            isExist = await checkVideoViewExistOnScreenByXpath(xpathVideoView);
            socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: `waiting check exist, isExist: ${isExist}`, url: url });
        }

        if (await checkVideoViewExistOnScreenByXpath(xpathVideoView)) {
            await delayTime(2000);
            // Nếu đã xuất hiện trên màn hình thì scroll đến video và click
            getDisplayedElementsListByXpath(xpathVideoView).then((elementList) => {
                // Cuộn đến video view và click xem
                return slowScrollToElementAndClick(elementList[0], 10000, dataRegister, url);
            }).then(() => {
                // click ok
                resolve();
            }).catch((error) => {
                reject(error);
            })
        }
    })
}

// Hàm get đối tượng từ localstorage
function getObjectFromLocalStorage(key) {
    return new Promise((resolve, reject) => {
        let data = localStorage.getItem(key);
        if (data) {
            resolve(JSON.parse(data));
        } else {

            resolve(null);
        }
    })
}

// Gởi request add video to watched list của account premium
let addVideoViewToWatchedList = (dataRegister) => {
    return new Promise((resolve, reject) => {
        getObjectFromLocalStorage("videoToView").then((videoView) => {
            socket.emit("addVideoViewToWatchedList", { gmailAccount: dataRegister.usernameGmail, videoId: videoView.videoId });
            resolve();
        })
    })
}

let injectJsCheckPlayEnded = () => {
    return new Promise((resolve, reject) => {
        const videoEndedId = 'checkVideoEndedPlay';
        var script = document.getElementById(videoEndedId);
        if (!script) {
            script = document.createElement("script");
            script.type = "text/javascript";
            script.setAttribute("id", videoEndedId);
            script.onload = function () { script.remove() };
            script.src = chrome.runtime.getURL("checkVideoEnded_inject.js");
            document.documentElement.appendChild(script);
        }
        resolve();
    })
}

let clickButtonAcceptPolice = async (dataRegister, url) => {
    const btnConfirmUnderstandSelector = 'input[id="confirm"]';
    if (await waitElementBySelector(btnConfirmUnderstandSelector, "btnConfirmUnderstandSelector")) {
        let btnConfirmUnderstand = await getElementBySelector(btnConfirmUnderstandSelector);
        await btnConfirmUnderstand.click();
        await socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: "Click Accept Police GG", url: url });
    } else {
        // không tìm thấy button
        await socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: "không tìm thấy btnAcceptPolice", url: url });
        await requestCaptureHtml("btnAcceptPoliceNotFound");
    }
}

let clickTryAgainSecure = async (dataRegister, url) => {
    const btnTryAgainSecureSelector = 'a[aria-label="Try again"]';
    if (await waitElementBySelector(btnTryAgainSecureSelector, "btnTryAgainSecureSelector")) {
        let btnTryAgainSecure = await getElementBySelector(btnTryAgainSecureSelector);
        await btnTryAgainSecure.click();
        await socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: "Click Secure Again GG", url: url });
    } else {
        // không tìm thấy button
        await socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: "không tìm thấy btnTryAgainSecure", url: url });
        await requestCaptureHtml("btnTryAgainSecureNotFound");
    }
}

let chooseVerifyMethod = async (dataRegister, url) => {
    let chooseVerifyMethodXpath = `//div[@class="lCoei YZVTmd SmR8" and .//div[contains(., "Confirm your recovery email")]]`;
    if (await waitElementBaseXpath(chooseVerifyMethodXpath, "chooseVerifyMethodXpath")) {
        let chooseVerifyMethod = await getElementByXpath(chooseVerifyMethodXpath);
        await chooseVerifyMethod.click();
        await socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: "Choose verify method GG", url: url });
    } else {
        // không tìm thấy button
        await socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: "không tìm thấy btnChooseVerifyMethod", url: url });
        await requestCaptureHtml("btnChooseVerifyMethodNotFound");
    }
}

let clickNotnow = async (dataRegister, url) => {
    const buttonNotNowXPath = `//button[.//span[contains(text(),'Not now') or contains(text(),'Để sau')]]`;
    if (await waitElementBaseXpath(buttonNotNowXPath, "buttonNotNowXPath")) {
        let btnNotnow = await getElementByXpath(buttonNotNowXPath);
        await btnNotnow.click();
        await socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: "Click Not Now GG", url: url });
    } else {
        // không tìm thấy button
        await socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: "không tìm thấy btnNotNow", url: url });
        await requestCaptureHtml("btnNotNowNotFound");
    }
}

let typeEmailRecovery = async (dataRegister, url) => {
    // await delayTime(1000);
    // Nhập email recovery
    let emailRecoverySelector = 'input[type="email"]';
    if (await waitElementBySelector(emailRecoverySelector, "Email Recovery selector")) {
        let emailRecoveryElement = await getElementBySelector(emailRecoverySelector);
        // await inputElementBySelector(emailRecoveryElement, dataRegister.emailRecovery);
        await typeOneByOneSimulatorContent(emailRecoveryElement, dataRegister.emailRecovery);
        await socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: "nhập Email Recovery", url: url });
        await delayTime(500);

        return true;
    } else {
        // không tìm thấy button
        await socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: "không tìm thấy inputEmailRecovery", url: url });
        await requestCaptureHtml("inputEmailRecoveryNotFound");
        return false;
    }
}

let backToPage = (randomTimeWatch) => {
    return new Promise(async (resolve, reject) => {
        try {
            await delayTime(randomTimeWatch);
            window.history.back();
            resolve();
        } catch (error) {
            reject(error);
        }
    })
}

let randomStringFunction = (length, chars) => {
    var result = '';
    for (var i = length; i > 0; --i) result += chars[Math.floor(Math.random() * chars.length)];
    return result;
}

let typeEmailRandom = async (emailRandom, dataRegister, url) => {
    let selector = "input[id='email-sign-up']";
    socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: `typeEmailRandom`, url: url });
    if (await waitElementBySelector(selector, "Email selector")) {
        let element = await getElementBySelector(selector);
        await typeOneByOneSimulatorContent(element, emailRandom);
    }
}

let typePassRandom = async (emailRandom, dataRegister, url) => {
    let selector = "input[id='js-password-input']";
    socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: `typePassRandom`, url: url });
    if (await waitElementBySelector(selector, "password selector")) {
        let element = await getElementBySelector(selector);
        await typeOneByOneSimulatorContent(element, emailRandom);
    }
}

let inputPromoCode = (dataRegister, url) => {
    return new Promise(async (resolve, reject) => {
        socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: `inputPromoCode`, url: url });
        let promocodeList = ["petar.brkicc02", "garrett.ua", "chelseajngs", "essentialjuicing"];
        let promocode = promocodeList[Math.floor(Math.random() * promocodeList.length)];
        let selector = "input[id='promotion-code']";
        if (await waitElementBySelector(selector, "promocode selector")) {
            let element = await getElementBySelector(selector);
            await typeOneByOneSimulatorContent(element, promocode);
        }
        resolve();
    })

}



let clickAgree = (dataRegister, url) => {
    return new Promise(async (resolve, reject) => {
        socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: `clickAgree`, url: url });
        let selector = "input[id='agree-to-terms']";
        if (await waitElementBySelector(selector, "agreeRadio")) {
            let element = getElementBySelector(selector);
            element.click();
        }
        resolve();
    })
}

let clickButtonRegister = (dataRegister, url) => {
    return new Promise(async (resolve, reject) => {
        socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: `clickButtonRegister`, url: url });
        let selector = "button[id='submit-registration']";
        if (await waitElementBySelector(selector, "buttonRegister")) {
            let element = getElementBySelector(selector);
            console.log("clickRegister");
            element.click();
        }
        resolve();
    })
}

let clickMonthlyPlan = (dataRegister, url) => {
    return new Promise(async (resolve, reject) => {
        socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: `clickButtonRegister`, url: url });
        let selector = "input[id='month-plan-signup']";
        if (await waitElementBySelector(selector, "clickMonthlyPlan")) {
            let btnNext = await getElementBySelector(selector);
            await btnNext.click();
            // btnNext.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: false, composed: true }));
            // btnNext.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: false, composed: true }));
            // await btnNext.dispatchEvent(new Event('click', { bubbles: true, cancelable: false, composed: true }));
        }
        resolve();
    })

}

let clickPayment = (dataRegister, url) => {
    return new Promise(async (resolve, reject) => {
        socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: `clickPayment`, url: url });
        let selector = "div[id='stripe-option-wrapper-signup']";
        if (await waitElementBySelector(selector, "clickMonthlyPlan")) {
            let btnNext = await getElementBySelector(selector);
            await btnNext.click();
        }
        resolve();
    })

}

let checkPromoTextConfirm = (dataRegister, url) => {
    return new Promise(async (resolve, reject) => {
        socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: `checkPromoTextConfirm`, url: url });
        let selector = "p[id='promo-code-check']";
        if (await waitElementBySelector(selector, "promoTextConfirm")) {
            resolve();
        }
    })
}

let clickApply = (dataRegister, url) => {
    return new Promise(async (resolve, reject) => {
        socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: `clickApply`, url: url });
        let selector = "button[id='check-promotion-code']";
        if (await waitElementBySelector(selector, "clickApply")) {
            console.log("exit");
            let btnNext = await getElementBySelector(selector);
            await btnNext.click();
            // btnNext.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: false, composed: true }));
            // btnNext.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: false, composed: true }));
            // await btnNext.dispatchEvent(new Event('click', { bubbles: true, cancelable: false, composed: true }));
        } else {
            console.log("not exit");
        }
        resolve();
    })
}

let clickQuestion1 = (dataRegister, url) => {
    return new Promise(async (resolve, reject) => {
        socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: `clickQuestion1`, url: url });
        let selector = "input[id='use-for-1']";
        if (await waitElementBySelector(selector, "clickQuestion1")) {
            let btnNext = await getElementBySelector(selector);
            await btnNext.click();
        }
        resolve();
    })
}

let clickQuestion2 = (dataRegister, url) => {
    return new Promise(async (resolve, reject) => {
        socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: `clickQuestion2`, url: url });
        let selector = "input[id='about-1']";
        if (await waitElementBySelector(selector, "clickQuestion2")) {
            let btnNext = await getElementBySelector(selector);
            await btnNext.click();
        }
        resolve();
    })
}

let clickSubmitSurvey = (dataRegister, url) => {
    return new Promise(async (resolve, reject) => {
        socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: `clickSubmitSurvey`, url: url });
        let selector = "//input[@name='commit']";
        let element = await getDisplayedElementsListByXpath(selector);
        console.log("element: ", element);
        if (element[0]) {
            element[0].click();
        }
        resolve();
    })
}

let clickLengthMenu = (dataRegister, url) => {
    return new Promise(async (resolve, reject) => {
        socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: `clickLengthMenu`, url: url });
        let buttonDownload = "//span[@class='btn-pool clickable btn-create-similar has-tooltip']";
        let selector = "//span[@class='parameter-title' and contains(text(), 'Length')]";
        if (await waitElementBaseXpath(buttonDownload, "buttonDownload")) {
            let element = await getDisplayedElementsListByXpath(selector);
            console.log("element: ", element);
            if (element[0]) {
                element[0].click();
            }
            resolve();
        }
    })
}

let clickLength5Min = (dataRegister, url) => {
    return new Promise(async (resolve, reject) => {
        socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: `clickLength5Min`, url: url });
        let selector = "//label[./div[./label[contains(text(),'5:00')]]]";
        // let selector = "//label[@class='length-cc align-item-center d-flex justify-content-center py-1']"
        let element = await getDisplayedElementsListByXpath(selector);
        console.log("element: ", element);
        if (element[0]) {
            element[0].click();
            await delayTime(1500);
        }
        resolve();
    })
}

let clickAllButtonDownload = (dataRegister, url) => {
    return new Promise(async (resolve, reject) => {
        let selector = "//span[@class='btn-pool clickable has-tooltip']";
        let downloadElement = "//div[@class='tooltip vue-tooltip-theme']";
        if (await waitElementBaseXpath(selector, "clickAllButtonDownload")) {
            let elements = await getDisplayedElementsListByXpath(selector);
            for (const element of elements) {
                await slowScrollToElementAndClickMusic(element, 1000, dataRegister, url)
                let downloadElementExist = await getElementByXpath(downloadElement);
                while (downloadElementExist) {
                    await delayTime(2000);
                    downloadElementExist = await getElementByXpath(downloadElement);
                }
                socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: `clickAllButtonDownload`, url: url });
            }
        }
        resolve();
    })
}



let clickAvatarAccount = () => {
    return new Promise(async (resolve, reject) => {
        let selector = "//div[@id='profile-btn']";
        let element = await getDisplayedElementsListByXpath(selector);
        element[0].click();
        await delayTime(1500);
    })
}

let clickLogoutAccount = () => {
    return new Promise(async (resolve, reject) => {
        let selector = "//a[@href='/users/sign_out']";
        let element = await getDisplayedElementsListByXpath(selector);
        element[0].click();
        await delayTime(1500);
    })
}

let checkDownloadComplete = (dataRegister, url) => {
    return new Promise(async (resolve, reject) => {
        let isComplete = false;
        while (!isComplete) {
            chrome.runtime.sendMessage({ isContent: true, request: 'checkDownload' }, function (response) {
                // socket = io("http://localhost:8081", { transports: ['websocket'] });
                socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: `Đang check download`, url: url });
                isComplete = response.downloading === 0 ? true : false;
            });
            await delayTime(2000);
        }
        resolve();
    })
}

// Lắng nghe message từ background js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.source === "background") {
        if (request.method === "updateURL") {
            // Màn hình nhập userName gmail
            if (request.currentURL === 'https://soundraw.io/users/sign_up') {
                //
                // random email
                let randomString = randomStringFunction(20, '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ');
                let emailRandom = `${randomString}@gmail.com`;
                getDataRegister().then(() => {
                    //type email
                    return typeEmailRandom(emailRandom, dataRegister, request.currentURL);
                }).then(() => {
                    //type pass
                    return typePassRandom(emailRandom, dataRegister, request.currentURL);
                }).then(() => {
                    // chọn gói tháng
                    return clickMonthlyPlan(dataRegister, request.currentURL);
                }).then(() => {
                    return clickPayment(dataRegister, request.currentURL);
                }).then(() => {
                    return inputPromoCode(dataRegister, request.currentURL);
                }).then(() => {
                    return clickApply(dataRegister, request.currentURL);
                }).then(() => {
                    return checkPromoTextConfirm(dataRegister, request.currentURL);
                }).then(() => {
                    return clickAgree(dataRegister, request.currentURL);
                }).then(() => {
                })
            }
            if (request.currentURL.includes('https://soundraw.io/users/confirm_sign_up?origin=acc_and_sub')) {
                getDataRegister().then(() => {
                    return clickQuestion1(dataRegister, request.currentURL);
                }).then(() => {
                    return clickQuestion2(dataRegister, request.currentURL);
                }).then(() => {
                    return clickSubmitSurvey(dataRegister, request.currentURL);
                }).then(() => { })
            }

            if (request.currentURL === 'https://soundraw.io/edit_music') {
                getDataRegister().then(() => {
                    return clickLengthMenu(dataRegister, request.currentURL);
                }).then(() => {
                    return delayTime(2000);
                }).then(() => {
                    return clickLength5Min(dataRegister, request.currentURL);
                }).then(() => {
                    return injectJsCheckPlayEnded();
                }).then(() => {
                    //span[@class='btn-pool clickable btn-create-similar has-tooltip']
                    return clickAllButtonDownload(dataRegister, request.currentURL);
                }).then(() => {
                    // let downloadedNum = localStorage.getItem("downloaded") === null ? 0 : parseInt(localStorage.getItem("downloaded"));
                    // while (downloadedNum < 15) {
                    //     console.log("downloadedNum: ", downloadedNum);
                    //     delayTime(2000).then(() => { });
                    //     downloadedNum = localStorage.getItem("downloaded") === null ? 0 : parseInt(localStorage.getItem("downloaded"));
                    // }
                    return checkDownloadComplete(dataRegister, request.currentURL);
                }).then(() => {
                    console.log("xong rồi!");
                    console.log("dataRegister: ", dataRegister);
                    return getDataRegister();
                }).then(() => {
                    console.log("xong rồi2!");
                    // console.log("dataRegister: ", dataRegister);
                    socket = io("http://localhost:8081", { transports: ['websocket'] });
                    // socket.emit("accountPreViewLifeEnd", { gmailAccount: dataRegister.usernameGmail });
                    socket.emit("writeLog", { usernameGmail: dataRegister.usernameGmail, log: `==========Done=========`, url: request.currentURL });
                    //send message đóng trình duyệt
                    chrome.runtime.sendMessage({ isContent: true, request: 'clearCookies' }, function (response) { });


                })
            }

            if (request.currentURL === 'https://soundraw.io/') {
                getDataRegister().then(() => {
                    socket.emit("homepage", { usernameGmail: dataRegister.usernameGmail, log: `homepage close`, url: request.currentURL });
                })
                chrome.runtime.sendMessage({ isContent: true, request: 'closeBrowser' }, function (response) { });
            }

            return true;
        }

        if (request.method === "clickButtonRegister") {
            let isTypeCardNumber = localStorage.getItem("typeCardNumber");
            let isTypeMonthYearEx = localStorage.getItem("typeMonthYearEx");
            let isTypeCcv = localStorage.getItem("typeCcv");
            console.log("isTypeCardNumber", isTypeCardNumber);
            console.log("isTypeMonthYearEx", isTypeMonthYearEx);
            console.log("isTypeCcv", isTypeCcv);

            if (!isTypeCardNumber && !isTypeMonthYearEx && !isTypeCcv) {
                getDataRegister().then(() => {
                    return clickButtonRegister(dataRegister, request.currentURL);
                }).then(() => { })
            }

            return true;
        }

        if (request.method === "downloadComplete") {
            console.log("downloadComplete");
            let numberDownloaded = localStorage.getItem("downloaded") === null ? 0 : parseInt(localStorage.getItem("downloaded"));
            console.log("numberDownloaded: ", numberDownloaded);
            numberDownloaded++;
            if (numberDownloaded === 15) {
                socket.emit("accountPreViewLifeEnd", { gmailAccount: dataRegister.usernameGmail });
                //send message đóng trình duyệt
                chrome.runtime.sendMessage({ isContent: true, request: 'closeBrowser' }, function (response) { });
            } else {
                localStorage.setItem("downloaded", numberDownloaded);
            }


            return true;
        }
    }

});
