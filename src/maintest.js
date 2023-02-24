// import axios from 'axios';
const axios = require('axios');
const GoLogin = require('./gologinv1');

const { Keyboard } = require('puppeteer-core');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

const useProxy = require('puppeteer-page-proxy');

puppeteer.use(StealthPlugin());




let mainFunction = async (req, res) => {

    const googleUsername = "reitanorichmongfae4595@gmail.com";
    const googlePassword = "rsoikat6iw";
    const googleRecovery = "pressonfleck9zd7819@gmail.com";

    // Gọi Api create new profile, kết quả trả về sẽ là profile Id và token
    let response = await axios.get('http://localhost:8080/api/v1/createProfile');

    // Nếu tạo thành công profile (errCode = 0) thì tiếp tục tiến trình
    console.log('>>> check res: ', response.data.errCode === 0);
    if (response.data.errCode === 0) {
        console.log('>>>>>> Tạo Profile thành công!');
        console.log('>>>>>> Profile Id: ', response.data.profileId);
        const widthBrowser = parseInt(response.data.resolution.split('x')[0]);
        const heightBrowser = parseInt(response.data.resolution.split('x')[1]);
        const browser = await puppeteer.connect({
            browserWSEndpoint: response.data.ws.toString(),
            ignoreHTTPSErrors: true,
        });

        const page = await browser.newPage();
        // page.authenticate({ username: 'gxxisxaqzm', password: 'wdhuarozyy' });

        // Setting kích thước màn hình khi remote (Đang base theo kích thước của profile Gologin)
        await page.setViewport({
            width: widthBrowser,
            height: heightBrowser,
            deviceScaleFactor: 1,
        });

        await page.waitForTimeout(1000);
        // Bắt đầu reg account
        console.log("Login to https://www.google.com");
        // await page.goto('https://www.youtube.com/premium', { waitUntil: "networkidle0", timeout: 90000 });
        // await page.goto('https://www.gmail.com/', { waitUntil: "networkidle0", timeout: 90000 });
        await page.goto('https://www.google.com', { waitUntil: "domcontentloaded", timeout: 0 });

        console.log("Đã tải xong!");

    } else {
        console.log('>>>>>> Tạo Profile không thành công!', response.message);
        return;
    }

}

/**
 * Hàm click button
 * tham số là selector của button
 */

clickButtonPuppeteer = async (page, btnSelector) => {
    const [button] = await page.$x(btnSelector);
    if (button) {
        await button.click();
        return true;
    } else {
        return false;
    }
}

/**
 * Check và điền input
 */
checkAndTypeInput = async (page, selectorCSS, textInput) => {
    await page.waitForSelector(selectorCSS, { visible: true });
    await page.type(selectorCSS, textInput);
}

/**
 * Check phần tử có trên màn hình không
 */
isVisible = async (page, xPathSelector, timeout) => {
    try {
        await page.waitForXPath(xPathSelector, { visible: true, timeout: timeout });
        return true;
    } catch {
        return false;
    }
}

mainFunction();