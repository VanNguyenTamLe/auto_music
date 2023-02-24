const delay = ms => new Promise(res => setTimeout(res, ms));

let getDisplayedElementsListByXpath1 = (xpath) => {
    return new Promise(async (resolve, reject) => {
        await delay(3000);
        let nodesSnapshot = document.evaluate(xpath, document, null, XPathResult.ORDERED_NODE_SNAPSHOT_TYPE, null);
        let displayedElements = [];
        for (let i = 0; i < nodesSnapshot.snapshotLength; i++) {
            let node = nodesSnapshot.snapshotItem(i);
            if (node.offsetParent !== null && node.ariaHidden === null) {
                displayedElements.push(node);
            }
        }
        resolve(displayedElements);
    })
}

let loopType1 = async (n, elm, EVENTS, textString) => {
    const temp = (textString + "")?.split();
    elm.value = elm.value + temp[n];
    elm.dispatchEvent(EVENTS.INPUT);
    if (++n < temp.length) {
        await delay(200);
        await loopType1(n, elm, EVENTS, temp);
    }
    return true;
}

let typeOneByOneSimulatorContent2 = async (elm, textString) => {
    let EVENT_OPTIONS = { bubbles: true, cancelable: false, composed: true };
    let EVENTS = {
        BLUR: new Event("blur", EVENT_OPTIONS),
        CHANGE: new Event("change", EVENT_OPTIONS),
        INPUT: new Event("input", EVENT_OPTIONS),
    };
    elm.value = "";
    if (await loopType1(0, elm, EVENTS, textString)) {
        return true;
    } else {
        return false;
    }
}

let typeCardNumber = (cardNumber) => {
    return new Promise(async (resolve, reject) => {
        let selector = "//input[@name='cardnumber']";
        let element = await getDisplayedElementsListByXpath1(selector);
        console.log("cardnumber: ", element);
        if (element[0]) {
            await typeOneByOneSimulatorContent2(element[0], cardNumber);
            localStorage.setItem('typeCardNumber', "true");
            chrome.runtime.sendMessage({ isFrame: true, request: 'clickButtonRegister' }, async function (response) { })
        }
        resolve();
    })
}

let typeMonthYearEx = (monthYearEx) => {
    return new Promise(async (resolve, reject) => {
        let selector = "//input[@name='exp-date']";
        let element = await getDisplayedElementsListByXpath1(selector);
        console.log("exp-date: ", element);
        if (element[0]) {
            await typeOneByOneSimulatorContent2(element[0], monthYearEx);
            localStorage.setItem('typeMonthYearEx', "true");
            chrome.runtime.sendMessage({ isFrame: true, request: 'clickButtonRegister' }, async function (response) { })
        }
        resolve();
    })
}

let typeCcv = (ccv) => {
    return new Promise(async (resolve, reject) => {
        let selector = "//input[@name='cvc']";
        let element = await getDisplayedElementsListByXpath1(selector);
        console.log("cvc: ", element);
        if (element[0]) {
            await typeOneByOneSimulatorContent2(element[0], ccv);
            localStorage.setItem('typeCcv', "true");
            chrome.runtime.sendMessage({ isFrame: true, request: 'clickButtonRegister' }, async function (response) { })
        }
        resolve();
    })
}

if (!window.isTop) { // true  or  undefined
    if (window.location.href.includes("https://js.stripe.com/v3/elements-inner-card")) {
        console.log("URL frame hiện tại: ", window.location.href);
        var requestContent = "requestCardInformation";
        chrome.runtime.sendMessage({ sendBack: true, request: requestContent }, function (response) {
            console.log("message from Background: ", response.statusRequest);
            if (response.statusRequest === 0) {
                let dataRegister = response.dataRegister;

                let cardNumber = dataRegister.card.cardNumber;
                let monthYearEx = `${dataRegister.card.monthEx}${dataRegister.card.yearEx}`;
                let ccv = dataRegister.card.ccv;

                typeCardNumber(cardNumber).then(() => { });
                typeMonthYearEx(monthYearEx).then(() => { });
                typeCcv(ccv).then(() => { });
            }
        });

    }
}

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.source === "background") {
        if (request.method === "recheckCardDeciline") {
            let socket = await io("http://localhost:8081", { transports: ['websocket'] });
            let isCardDeciline = await checkCardDeciline();
            console.log(">>>>> isCardDeciline: ", isCardDeciline);
            if (isCardDeciline) {
                console.log(">>>>> isCardDeciline: ", isCardDeciline);
                await socket.emit('CardIsDeclined', { dataRegister: request.dataRegister, contentAlert: isCardDeciline.textContent });
                await socket.on('serverRespond', () => {
                    console.log(">>>>> serverRespond freame: ");
                    chrome.runtime.sendMessage({ isFrame: true, request: 'closeBrowser' }, async function (response) { });
                });

            } else {
                await socket.emit('CardIsDeclined', { dataRegister: request.dataRegister, contentAlert: "Card Declined Không xác định" });
                await socket.on('serverRespond', () => {
                    console.log(">>>>> serverRespond freame: ");
                    chrome.runtime.sendMessage({ isFrame: true, request: 'closeBrowser' }, async function (response) { });
                });
            }
            return true;
        }
    }

})

let choosePayment = () => {
    let selectorRadioButtonAddCard = "div[jsname='wQNmvb']";
    let xpathBtnPayment = "//div[@role='radio' and .//*[contains(text(), 'debit card')]]";

    return new Promise((resolve, reject) => {
        waitForElm(selectorRadioButtonAddCard, "selectorRadioButtonAddCard", "", "").then((dataCompleteChoosePayment) => {
            return waitElementJQueryXpath(xpathBtnPayment, "xpathBtnPayment", "click", "");
        }).then((dataXpathBtnPayment) => {
            console.log("Chọn phương thức payment!");
            return clickButtonSubmitChoosePaymentMethod();
        }).then((dataSelectorBtnSubmitPaymentMethod) => {
            console.log("Click button submit sau khi chọn thêm thẻ");
            resolve("OK")
        })
            .catch((err) => {
                console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>:", err);
                reject(err);
            })

    })
}

let clickButtonSubmitChoosePaymentMethod = async () => {
    let selectorBtnSubmitPaymentMethod = "button[role='button']";
    await delay(5000);
    await waitForElm(selectorBtnSubmitPaymentMethod, "selectorBtnSubmitPaymentMethod", "click", "");
}

let inputCardInformation = async (cardNumber, monthEx, yearEx, ccv, zipcode) => {

    const EVENT_OPTIONS = { bubbles: true, cancelable: false, composed: true };
    const EVENTS = {
        BLUR: new Event("blur", EVENT_OPTIONS),
        CHANGE: new Event("change", EVENT_OPTIONS),
        INPUT: new Event("input", EVENT_OPTIONS),
    };

    let selectorInputCardNumber = "input[aria-label='Card number']";
    await waitElementBaseSelector(selectorInputCardNumber, "selectorInputCardNumber", "type", cardNumber, EVENTS).then(() => {
        console.log("Input Card Number");
    })

    let selectorInputMonthEx = "input[aria-label='MM/YY']";
    let monthYear = `${monthEx}${yearEx}`;
    await waitForElm(selectorInputMonthEx, "selectorInputMonthEx", "type", monthYear, EVENTS).then(() => {
        console.log("Input month Year Ex");
    })

    let selectorinputCcv = "input[aria-label='Security code']";
    await waitForElm(selectorinputCcv, "selectorinputCcv", "type", ccv, EVENTS).then(() => {
        console.log("Input Ccv code");
    })

    let selectorinputZipcode = "input[aria-label='Billing zip code']";
    await waitForElm(selectorinputZipcode, "selectorinputZipcode", "type", zipcode, EVENTS).then(() => {
        console.log("Input zipcode");
    })



    return "OK";

}

let checkCardIsVerify = async () => {
    let elementVerifySelector = "div[jsname='wQNmvb']";
    let elementOkSelector = "button[role='button']";
    let timeout = 5;
    while (true) {
        let elementVerifys = await document.querySelectorAll(elementVerifySelector);
        if (elementVerifys) {
            elementVerifys.forEach(elementVerify => {
                if (elementVerify.textContent.includes("Verify")) {
                    console.log(">>>>>>>>>>>>>>>>> elementVerify.textContent: ", elementVerify.textContent);
                    return true;
                }
            });
        }
        if (timeout === 0) {
            return false;
        }
        timeout--;
        await delay(1000);
    }
}

let checkCardIsNotCharge = async () => {
    let elertXpath = `//*[@role="alert" and .//*[contains(text(), "can't")]]`;
    // let elertXpath = `//*[@role="alert"]`;
    if (await waitElementBaseXpath2(elertXpath, 'checkCardIsNotCharge', 10)) {
        let alertelm = await getElementByXpath2(elertXpath);
        return alertelm;
    } else {
        return false;
    }
}

let checkCardIsOrMivem02 = async () => {
    let elertXpath = `//*[@role="alert" and .//*[contains(text(), "OR_")]]`;
    if (await waitElementBaseXpath2(elertXpath, 'checkCardIsOrMivem02', 5)) {
        let alertelm = await getElementByXpath2(elertXpath);
        return alertelm;
    } else {
        return false;
    }
}

let checkCardDeciline = async () => {
    let elertXpath = `//*[@role="alert" and .//*[contains(text(), "declined") or contains(text(), "can't")]]`;
    if (await waitElementBaseXpath2(elertXpath, 'checkCardDeciline', 10)) {
        let alertelm = await getElementByXpath2(elertXpath);
        return alertelm;
    } else {
        return false;
    }
}

// let isVerifyCard = async (emailAccount, cardNumber) => {
let isVerifyCard = async (dataRegister) => {
    let isVerfiry = await checkCardIsVerify();
    if (isVerfiry) {
        console.log(">>>>> isVerfiry: ", isVerfiry);
        let socket = await io("http://localhost:8081", { transports: ['websocket'] });
        await socket.emit('CardIsVerify', { dataRegister: dataRegister, contentAlert: "Card is verify" });
    }
    let cardIsNotCharge = await checkCardIsNotCharge();
    if (cardIsNotCharge) {
        console.log(">>>>> cardIsNotCharge: ", cardIsNotCharge);
        let socket = await io("http://localhost:8081", { transports: ['websocket'] });
        await socket.emit('CardIsNotCharge', { dataRegister: dataRegister, contentAlert: cardIsNotCharge.textContent });
    }
    let cardIsOrMivem02 = await checkCardIsOrMivem02();
    if (cardIsOrMivem02) {
        console.log(">>>>> cardIsOrMivem02: ", cardIsOrMivem02);
        let socket = await io("http://localhost:8081", { transports: ['websocket'] });
        await socket.emit('CardIsOrMivem02', { dataRegister: dataRegister, contentAlert: cardIsOrMivem02.textContent });
    }
    if (!isVerfiry && !cardIsNotCharge && !cardIsOrMivem02) {
        await clickButtonSubmitChoosePaymentMethod();
        return false;
    } else {
        return true;
    }
}

let getElementByXpath2 = async (xpath) => {
    return document.evaluate(xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
}

let waitElementBaseXpath2 = async (xPathElement, elementName, timeout) => {
    let element = await getElementByXpath2(xPathElement);
    let timeoutWaitElement = timeout ? timeout : 5;
    while (element === null) {
        element = await getElementByXpath2(xPathElement);
        if (timeoutWaitElement === 0) {
            return false;
        }
        console.log(`waiting element ${elementName}`);
        await delay(1000);
        timeoutWaitElement--;
    }
    return true;
}



let waitElementJQueryXpath = async (xPathElement, elementName, action, inputValue) => {
    let elementResult = await $(document).xpath(xPathElement);
    while (elementResult.length === 0) {
        elementResult = await $(document).xpath(xPathElement);
        await delay(1000);
        console.log(`>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> Waitting ${elementName}`);
        console.log(`>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> elementResult ${elementResult}`);
    }
    if (action === "click") {
        await elementResult.click();
    }
    if (action === "type") {
        elementResult.value = inputValue;
    }
    return "OK";
}

let clickButtonBaseTextContent = async (textContent) => {
    await delay(5000);
    const EVENT_OPTIONS = { bubbles: true, cancelable: false, composed: true };
    const EVENTS = {
        BLUR: new Event("blur", EVENT_OPTIONS),
        CHANGE: new Event("change", EVENT_OPTIONS),
        CLICK: new Event("click", EVENT_OPTIONS),
    };
    let buttons = await document.querySelectorAll("button");
    buttons.forEach(button => {
        if (button.textContent.includes(textContent)) {
            button.dispatchEvent(EVENTS.CLICK);
        }
    });
}



let waitElementBaseSelector = async (selectorElement, elementName, action, inputValue, events) => {
    let elementResult = await document.querySelector(selectorElement);
    while (!elementResult) {
        elementResult = await document.querySelector(selectorElement);
        await delay(1000);
        console.log(`>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>> Waitting ${elementName}`);
    }
    if (action === "click") {
        await elementResult.click();
    }
    if (action === "type") {
        elementResult.value = inputValue;
        elementResult.dispatchEvent(events.INPUT);
    }
    return "OK";
}

let waitForElm = (selector, elementName, action, inputValue, events) => {
    return new Promise(resolve => {
        if (document.querySelector(selector)) {
            console.log(`${elementName} is ready`);
            if (action === "click") {
                document.querySelector(selector).click();
            }
            if (action === "type") {
                document.querySelector(selector).value = inputValue;
                document.querySelector(selector).dispatchEvent(events.INPUT);
            }
            return resolve(true);

        }
        const observer = new MutationObserver(mutations => {
            if (document.querySelector(selector)) {
                resolve(document.querySelector(selector));
                observer.disconnect();
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    });
}



