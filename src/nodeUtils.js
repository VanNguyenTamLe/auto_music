const fs = require('fs');
const path = require('path');
var request = require('request');
const os = require('os');
const userHomeDir = os.homedir();
const AdmZip = require("adm-zip");

let getContentTxtFromApi = (url) => {
    return new Promise((resolve, reject) => {
        request.get(url, function (error, response, body) {
            if (error) {
                reject(error);
            } else if (response.statusCode !== 200) {
                reject(new Error(`Request failed with status code ${response.statusCode}`));
            } else {
                resolve(body);
            }
        });
    });
}

let downloadZipFileFromUrl = async (url, folder, timeout = 60000) => {
    return new Promise((resolve, reject) => {
        request({ url: url, encoding: null }, function (err, resp, body) {
            if (err) throw err;
            fs.writeFile(folder, body, function (err) {
                console.log("file written!");
                resolve(true);
            });
        });
    })
}

let unzipFile = async (pathFile, outputFolder) => {
    return new Promise((resolve, reject) => {
        try {
            const zip = new AdmZip(pathFile);
            zip.extractAllTo(outputFolder);
            resolve();
        } catch (error) {
            reject(error);
        }


    })
}

let checkAndDownloadLastestObitar = async () => {

    let tubexxxbrowserPath = path.join(userHomeDir, 'vannguyenlp', 'browser');
    console.log(tubexxxbrowserPath);
    if (!fs.existsSync(tubexxxbrowserPath)) {
        fs.mkdirSync(tubexxxbrowserPath, { recursive: true });
    }

    const currentVerWin = fs.existsSync(path.join(userHomeDir, 'vannguyenlp', 'browser', 'orbita-browser', 'version')) ? fs.readFileSync(path.join(userHomeDir, 'vannguyenlp', 'browser', 'orbita-browser', 'version').replace(/\r|\n/g, ''), 'utf8') : '';
    const lastVerWin = await getContentTxtFromApi(`https://orbita-browser-windows-wc.gologin.com/latest-version.txt`).catch(() => { return false; });

    console.log("current Obitar: ", currentVerWin);
    console.log("Lastest Obitar: ", lastVerWin);

    if (!currentVerWin || currentVerWin != lastVerWin) {
        console.log("Obitar Xưa rồi Diễm ơi!");
        let browserPath = path.join(userHomeDir, 'vannguyenlp', 'browser', 'orbita-browser');
        if (fs.existsSync(browserPath)) {
            console.log(`Remove old browser version: ${currentVerWin || '0'}`);
            fs.rmSync(browserPath, { force: true, recursive: true });
        }
        console.log(`Download new browser version: ${lastVerWin || '0'}`);
        let filename = path.join(userHomeDir, 'vannguyenlp', 'browser', 'orbita-browser-latest.zip');
        // const fileDownload = await utils.Request.Download('https://orbita-browser-windows-wc.gologin.com/orbita-browser-latest.zip', tubexxxbrowserPath, 'orbita-browser-latest.zip', 30 * 60 * 1000);
        const fileDownload = await downloadZipFileFromUrl('https://orbita-browser-windows-wc.gologin.com/orbita-browser-latest.zip', filename, 30 * 60 * 1000);
        if (fileDownload) {
            unzipFile(filename, tubexxxbrowserPath).then(() => {
                console.log(`Success unzip browser`);
                return true;
            }).catch((error) => {
                console.log(`unzip file error: ${error}`);
                return false;
            })
        } else {
            console.log(`error`);
            return false;
        }
    } else {
        console.log("Obitar is latest!");
        return true;
    }
}

module.exports = {
    getContentTxtFromApi: getContentTxtFromApi,
    downloadZipFileFromUrl: downloadZipFileFromUrl,
    checkAndDownloadLastestObitar: checkAndDownloadLastestObitar
}