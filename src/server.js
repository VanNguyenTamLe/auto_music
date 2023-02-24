//import express library
// import express from "express";
const express = require('express');
// Hỗ trợ lấy các tham số mà user gửi đến
// import bodyParser from "body-parser";
const bodyParser = require('body-parser');
const moment = require('moment-timezone');
const crypto = require('crypto');
const fsExtra = require('fs-extra');
const rimraf = require('rimraf');

// import các hàm configs
const viewEngine = require('./config/viewEngine');
const initWebRoutes = require('./route/web');
const osUtil = require('os-utils');

// ghi log nhanh
const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf } = format;

require('dotenv').config();

let app = express();

// config socketio
const http = require('http');
const server = http.createServer(app);

const io = require("socket.io")(server, {
    cors: {
        origin: '*',
    }
});

// config app
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }))

viewEngine(app);
initWebRoutes(app);

// Lấy port trong file môi trường .env
let port = process.env.PORT || 6969;

server.listen(port, () => {
    console.log("Backend Nodejs is running on the port: ", port);
})

const GoLogin = require('./gologinv1');
const Gologin = require('./gologin');
const fetch = require('node-fetch');
const nodeUtils = require('./nodeUtils');

const { Keyboard } = require('puppeteer-core');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

const cluster = require('cluster');
const os = require('os');
const fs = require('fs');
const path = require('path');
const numCpu = os.cpus().length;
const userHomeDir = os.homedir();
const childprocess = require('child_process');
puppeteer.use(StealthPlugin());
let serverIp = process.env.SERVER;
// var client = require("socket.io-client");
// var socketClient = client.connect(serverIp);
const { execFile } = require('child_process');

// socketClient.emit('settingDataApp');

let processRunnings = {};
let openProfileRunning = 0;
// const uniqueSession = randomValueHex(10);

// Tổng số client connect đến app
let totalClientConnection = 0;

function randomValueHex(len) {
    return crypto.randomBytes(Math.ceil(len / 2))
        .toString('hex') // convert to hexadecimal format
        .slice(0, len).toUpperCase();   // return required number of characters
}

io.on("connection", (socket) => {
    console.log("a user connected: ", socket.id);

    socket.on("createRoomAccountView", async (msg) => {
        socket.join(msg);
    });

    // Nhận thông báo kết thúc chu trình của 1 profile
    socket.on("accountPreViewLifeEnd", async (msg) => {
        let gmailAccount = msg.gmailAccount;
        delete processRunnings[gmailAccount];
        console.log(msg);
        // giảm biến số lượng account đang chạy
        openProfileRunning--;
    });

    // ghi log txt
    socket.on("writeLog", async (msg) => {
        let account = msg.usernameGmail;
        let textLog = msg.log;
        console.log(textLog);
        let currentUrl = msg.url;
        processRunnings[account].lastTimeUpdate = new Date().getTime();
        processRunnings[account].url = currentUrl;
    });

    socket.on("homepage", async (msg) => {
        console.log("homepage: ", msg);
        let account = msg.usernameGmail;
        delete processRunnings[account];
        // giảm biến số lượng account đang chạy
        openProfileRunning--;
    });

    socket.on("disconnect", () => {
        // Giảm tổng số client connect đến app
        totalClientConnection--;
        console.log('!!!! a user disconnected: ', socket.id);
    });
})

let listAllAccountPreRunning = (processRunnings) => {
    return new Promise((resolve, reject) => {
        let accounts = [];
        for (let key in processRunnings) {
            accounts.push(key);
        }
        resolve(accounts);
    })
}

let killProcess = (pid) => {
    try {
        process.kill(pid);
        console.log(`Process with PID ${pid} has been killed.`);
    } catch (error) {
        console.error(`Failed to kill process with PID ${pid}. Error: ${error.message}`);
    }
}

let checkActiveBrowserAndKill = async () => {
    // Lấy tất cả các room đang hoạt động
    // let roomsName = await listAllRoomsCurrent();

    // Lấy tất cả danh sách các account đang running
    let accountPreList = await listAllAccountPreRunning(processRunnings);
    console.log("================account đang running: ", accountPreList);
    console.log("================process running: ", processRunnings);

    // Lấy danh sách các account không tồn tại trong room
    // let accountInActiveRoom = await listAllAccountInActive(roomsName, accountPreList);

    // kill process
    for (let accountPre of accountPreList) {
        // Get object Running
        let objectRunning = processRunnings[accountPre];
        let lastTimeNotUpdate = new Date().getTime() - objectRunning.lastTimeUpdate;
        let currentUrl = objectRunning.url;

        if ((!currentUrl || currentUrl === "") && lastTimeNotUpdate > 120000) {
            delete processRunnings[accountPre];
            // kill process chrome by process id
            killProcess(objectRunning.pid);

            openProfileRunning--;
        }
    }
}

let countKeys = (obj) => {
    const keys = Object.keys(obj);
    return keys.length;
}

let getListProfileNotRun = (profileArray, runningObject) => {
    return new Promise((resolve, reject) => {
        const missingProfiles = [];

        // Duyệt qua từng phần tử trong profileArray
        for (const profile of profileArray) {
            // Lấy tên thư mục từ đường dẫn
            const profileName = profile.split('\\').pop();

            // Kiểm tra xem tên thư mục có tồn tại trong runningObject hay không
            if (!runningObject.hasOwnProperty(profileName)) {
                missingProfiles.push(profile);
            }
        }

        resolve(missingProfiles);
    })
}

let getAllFolderInDirectory = (dirPath) => {
    return new Promise((resolve, reject) => {
        const folders = fs.readdirSync(dirPath).filter(file => {
            return fs.statSync(`${dirPath}\\${file}`).isDirectory();
        }).map(folder => {
            return `${dirPath}\\${folder}`;
        });
        resolve(folders);
    })
}

let readTextFile = (filename) => {
    return new Promise((resolve, reject) => {
        try {
            const data = fs.readFileSync(filename, 'utf8');
            resolve(data);
        } catch (err) {
            console.error(err);
            reject(err);
        }
    })
}

let mainFunction = () => {
    // xóa thư mục temp cũ
    const tempDirectory = path.join(userHomeDir, 'tempProfileMusic');

    if (fsExtra.existsSync(tempDirectory)) {
        fsExtra.emptyDirSync(tempDirectory);
    }

    setInterval(checkBrowserActive, 10000);
    setInterval(checkActiveBrowserAndKill, 120000);
}
const delayTime = ms => new Promise(res => setTimeout(res, ms));
let checkBrowserActive = async () => {
    // Lấy ra thư mục chứa profile
    let pathProfilesList = path.join(userHomeDir, 'profileChrome');
    // Lấy ra mảng tất cả profile
    let allProfiles = await getAllFolderInDirectory(pathProfilesList);

    // Nếu mảng này lớn hơn số profile đang chạy thì:
    if (allProfiles.length > openProfileRunning) {
        // Lấy tất cả profile chưa chạy
        let listProfileNotRun = await getListProfileNotRun(allProfiles, processRunnings);

        // Lặp qua và chạy
        for (const profilePath of listProfileNotRun) {
            await openProfile(profilePath, profilePath.split('\\').pop());
        }
    }

    // let totalProfileMax = 1;
    // console.log(`>>>> Profile Running/Max: ", ${openProfileRunning}/${totalProfileMax}`);
    // if (openProfileRunning < totalProfileMax) {
    //     await openProfile();
    // }
}

let openProfile = async (newProfileDir, profileName) => {

    openProfileRunning++;

    const uniqueTemp = randomValueHex(12);

    let initData = {
        "gmailAccount": {
            "usernameGmail": "",
            "passwordGmail": ""
        },
        "cookies": "",
        "card": {
            "cardNumber": "",
            "monthEx": "",
            "yearEx": "",
            "ccv": ""
        },
        "pid": ""
    }
    let cardInfos = await readTextFile("card.txt");
    console.log(cardInfos);
    initData.gmailAccount.usernameGmail = profileName;
    if (cardInfos) {
        let card = cardInfos.trim().split('\n')[1];
        console.log("card: ", card);
        initData.card.cardNumber = card.split('|')[0];
        initData.card.monthEx = card.split('|')[1];
        initData.card.yearEx = card.split('|')[2];
        initData.card.ccv = card.split('|')[3];
    }
    console.log(initData);

    // // khai báo đường dẫn profile mới
    // const newProfileDir = path.join(userHomeDir, 'tempProfileMusic', `vannguyenlp-pro-${uniqueTemp}`);
    // // Tạo thư mục newProfileDir
    // fs.mkdirSync(newProfileDir, { recursive: true });

    // C:\Users\Administrator\AppData\Local\Google\Chrome\User Data\Profile 7
    // const newProfileDir = path.join(userHomeDir, 'AppData', 'Local', 'Google', 'Chrome', 'User Data', 'Profile 7');

    let chromeExePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

    const extensionDir = path.join(userHomeDir, 'tempProfileMusic', `vannguyenlp-e-${uniqueTemp}`);



    // Tạo thư mục extension
    fs.mkdirSync(extensionDir, { recursive: true });

    fs.cpSync(path.join(__dirname, 'extension', 'Auto_music_soundraw'), extensionDir, { recursive: true });
    fs.writeFileSync(path.join(extensionDir, 'dataRegister.json'), JSON.stringify(initData));
    let params = [
        // `--user-data-dir=${profilePath}`,
        `--user-data-dir=${newProfileDir}`,
        `--password-store=basic`,
        `--disable-notifications`,
        `--disable-encryption`,
        `--lang=en-US`,
        `--disable-popup-blocking`,
        `--disable-backgrounding-occluded-windows`,
        `--load-extension=${extensionDir}`
    ];

    const child = childprocess.execFile(chromeExePath, params);

    console.log("const child = ", child.pid);
    initData.pid = child.pid;

    let newRunning = {};

    let newDataRunning = {
        pid: child.pid,
        lastTimeUpdate: new Date().getTime(),
        url: ""
    }

    newRunning[profileName] = newDataRunning;
    Object.assign(processRunnings, newRunning);

}

mainFunction();
