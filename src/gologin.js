const AbortController = require("abort-controller");
const fetch = require('node-fetch');
const fs = require('fs');
const os = require('os');
const { access } = require('fs').promises;
const childprocess = require('child_process');
const path = require('path');
const _ = require('lodash');
const fontsCollection = require('./fonts');
const FONTS_URL = 'https://fonts.gologin.com/';
const HttpsProxyAgent = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');
const userHomeDir = os.homedir();
const AdmZip = require("adm-zip");
const API_URL = 'https://api.gologin.com';

const getAgent = (proxyUrl) => {
    if (proxyUrl.startsWith("http")) {
        return new HttpsProxyAgent(proxyUrl);
    } else if (proxyUrl.startsWith("socks")) {
        return new SocksProxyAgent(proxyUrl.endsWith("/") ? proxyUrl : proxyUrl + "/");
    }
    return null;
}

const Sleep = (ms) => new Promise(resolve => setTimeout(function () {
    resolve('ok')
}, ms));

const Request = {
    Get: async function (url, options = {}) {
        const controller = new AbortController();
        const timeout = setTimeout(
            () => { controller.abort(); },
            options.timeout || 15000,
        );
        let data = null;
        try {
            let fetchOption = {
                method: "get",
                headers: {},
                signal: controller.signal,
                cache: "no-store"
            };
            if (options.proxyUrl) {
                fetchOption.agent = getAgent(options.proxyUrl);
            }
            if (options.proxyUrl && !fetchOption.agent) {
                throw "error proxy";
            }
            if (options.headers) {
                fetchOption.headers = options.headers;
            }
            fetchOption.headers['Cache-Control'] = 'no-cache';
            fetchOption.headers['Content-Type'] = 'application/json';
            fetchOption.headers['User-Agent'] = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${Math.floor(Math.random() * 5) + 98}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)} Safari/537.36`;
            const res = await fetch(url, fetchOption);
            data = await res.json();
        } catch (e) {
            console.error('Request', e.message);
        } finally {
            clearTimeout(timeout);
        }
        return data;
    },
    Post: async function (url, jsonOject, options = {}) {
        const controller = new AbortController();
        const timeout = setTimeout(
            () => { controller.abort(); },
            options.timeout || 60000,
        );
        let data = null;
        try {
            let fetchOption = {
                method: "post",
                headers: {},
                signal: controller.signal,
                body: JSON.stringify(jsonOject),
                cache: "no-store"
            };
            if (options.proxyUrl) {
                fetchOption.agent = getAgent(options.proxyUrl);
            }
            if (options.proxyUrl && !fetchOption.agent) {
                throw "error proxy";
            }
            if (options.headers) {
                fetchOption.headers = options.headers;
            }
            fetchOption.headers['Cache-Control'] = 'no-cache';
            fetchOption.headers['Content-Type'] = 'application/json';
            fetchOption.headers['User-Agent'] = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${Math.floor(Math.random() * 5) + 98}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)}.${Math.floor(Math.random() * 10)} Safari/537.36`;

            const res = await fetch(url, fetchOption);
            data = await res.json();
        } catch (e) {
            console.error('Request', e.message);
        } finally {
            clearTimeout(timeout);
        }
        return data;
    },
    Download: async (url, folder, filename, timeout = 60000) => {
        //console.log('Download', `url: ${url}, folder: ${folder}, filename: ${filename}, timeout: ${timeout}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
            const filePath = path.join(folder, filename);
            if (fs.existsSync(filePath)) {
                fs.rmSync(filePath);
            }
            const rs = await fetch(url, {
                signal: controller.signal,
                cache: 'no-store',
                headers: {
                    'Cache-Control': 'no-cache'
                }
            });
            const arrayBuffer = await rs.arrayBuffer();
            fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
            return filePath;
        } catch (e) {
            console.error('request.Download', e.message);
        } finally {
            clearTimeout(timeoutId);
        }
        return null;
    }
};

async function CreateProfile(proxyUrl, token) {
    let output = { error: 1 };
    if (token) {
        try {
            const fingerprint = await GologinUtil.RandomFingerprint(proxyUrl, token);
            if (fingerprint) {
                const { navigator, fonts, webGLMetadata, webRTC } = fingerprint;
                if (!navigator) {
                    return CreateProfile(proxyUrl, token);
                }
                let deviceMemory = navigator.deviceMemory || 2;
                if (deviceMemory < 1) {
                    deviceMemory = 1;
                }
                navigator.deviceMemory = deviceMemory;
                webGLMetadata.mode = 'mask';

                let json = {
                    ...fingerprint,
                    navigator,
                    webGLMetadata,
                    browserType: 'chrome',
                    name: `p${Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)}`,
                    notes: 'auto generated',
                    fonts: {
                        families: fonts,
                    },
                    webRTC: {
                        "mode": "alerted",
                        "enabled": true,
                        "fillBasedOnIp": true,
                        "localIpMasking": true,
                        "publicIp": "",
                        "customize": true,
                        "localIps": []
                    },
                };
                json.proxyEnabled = false;
                json.googleClientId = '';
                json.googleServicesEnabled = false;
                json.startUrl = 'https://iphey.com';
                json.lockEnabled = false;
                json.debugMode = false;
                json.dns = '';
                json.proxy = {
                    "mode": "none",
                    "host": "",
                    "port": 80,
                    "username": "",
                    "password": "",
                    "autoProxyRegion": "us",
                    "torProxyRegion": "us"
                }
                json.isM1 = false;
                json.timezone = {
                    "enabled": true,
                    "fillBasedOnIp": true,
                    "timezone": ""
                }
                json.audioContext = {
                    "mode": "noise"
                }
                json.extensions = {
                    "enabled": true,
                    "preloadCustom": true,
                    "names": []
                }
                json.storage = {
                    "local": true,
                    "extensions": true,
                    "bookmarks": true,
                    "history": true,
                    "passwords": true,
                    "session": true
                }
                json.plugins = {
                    "enableVulnerable": true,
                    "enableFlash": true
                }
                json.cookies = [];
                json.chromeExtensions = [];
                json.userChromeExtensions = [];
                json.chromeExtensionsToNewProfiles = [];
                json.userChromeExtensionsToNewProfiles = [];
                const response = await Request.Post(`${API_URL}/browser`, json, {
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                    proxyUrl: proxyUrl
                });

                if (response) {
                    if (response.id) {
                        let profile = await Request.Get(`${API_URL}/browser/${response.id}`, {
                            headers: {
                                'Authorization': `Bearer ${token}`
                            },
                            proxyUrl: proxyUrl
                        });
                        if (profile) {
                            profile.name_base64 = Buffer.from(profile.name).toString('base64');
                            profile.profile_id = response.id;
                            output.error = 0;
                            output.data = profile;
                        } else {
                            output.message = 'Error Get Profile';
                        }
                    }
                } else {
                    output.message = 'Error Post Profile';
                }
            } else {
                output.message = 'Error RandomFingerprint';
            }
        } catch (e) {
            console.error('CreateProfile', e.message);
            output.message = e.message;
        }
    } else {
        output.message = "ERROR_TOKEN";
    }
    if (output.error == 1 && !output.message) {
        output.message = "Unknow";
    }
    return output;
};

async function GetNewToken(proxyUrl) {
    try {
        const rs = await Request.Post('https://api.gologin.com/user?free-plan=true', {
            "email": `bunu${Math.floor(Math.random() * 99999999) + 10000000}82b@gmail.com`,
            "password": "92982@gmail.com",
            "passwordConfirm": "92982@gmail.com",
            "googleClientId": "1609784817.1663935520",
            "filenameParserError": "",
            "fromApp": false,
            "fromAppTrue": false,
            "canvasAndFontsHash": "cbae1dd791689bb8",
            "affiliate": "",
            "fontsHash": "b50511932f0f54ad",
            "canvasHash": "448809179"
        }, {
            headers: {
                "accept": "*/*",
                "accept-language": "vi",
                "content-type": "application/json",
                "sec-ch-ua": "\"Google Chrome\";v=\"105\", \"Not)A;Brand\";v=\"8\", \"Chromium\";v=\"105\"",
                "sec-ch-ua-mobile": "?0",
                "sec-ch-ua-platform": "\"Windows\"",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-site",
                "Referer": "https://app.gologin.com/",
                "Referrer-Policy": "strict-origin-when-cross-origin",
            },
            proxyUrl: proxyUrl
        });
        return rs && rs.token ? rs.token : null;
    } catch (e) {
        console.error('NewToken', e.message);
    }
    return null;
}

async function StartProfile(email, profile, proxyUrl, customParam) {
    let output = { error: 1 };
    const ORBITA_BROWSER = path.join(userHomeDir, 'vannguyenlp', 'browser', 'orbita-browser', process.platform === 'win32' ? 'chrome.exe' : 'chrome');
    if (!profile || !profile.name) {
        output.message = 'profile is null';
    } else if (!customParam || !Array.isArray(customParam)) {
        output.message = 'customParam is null or not array, can set []';
    } else if (!email) {
        output.message = 'email is null';
    } else if (!fs.existsSync(ORBITA_BROWSER)) {
        output.message = `ORBITA_BROWSER not found -> ${ORBITA_BROWSER}`;
    } else {
        try {
            const differentOs = profile.os !== 'android' && (
                process.platform === 'win32' && profile.os !== 'win' ||
                process.platform === 'darwin' && profile.os !== 'mac' ||
                process.platform === 'linux' && profile.os !== 'lin'
            );

            // const profilePath = fs.mkdtempSync(path.join(os.tmpdir(), 'tempRun', `vannguyenlp-p-${email}-`));
            const profilePath = fs.mkdirSync(path.join(userHomeDir, 'tempProfile', `vannguyenlp-p-${email}-`), { recursive: true });

            const { navigator = {}, fonts } = profile;
            const zero_profile = fs.readFileSync(path.resolve(__dirname, 'zero_profile.zip'));
            const zip = new AdmZip(zero_profile);
            zip.extractAllTo(profilePath, true, false);
            const singletonLockPath = path.join(profilePath, 'SingletonLock');
            const singletonLockExists = await access(singletonLockPath).then(() => true).catch(() => false);
            if (singletonLockExists) {
                fs.unlinkSync(singletonLockPath);
            }
            const pref_file_name = path.join(profilePath, 'Default', 'Preferences');
            if (!fs.existsSync(pref_file_name)) {
                throw new Error('Profile preferences file not found');
            }
            const preferences_raw = fs.readFileSync(pref_file_name, 'utf8');
            let preferences = JSON.parse(preferences_raw);

            let geo = await GologinUtil.GeoIP(proxyUrl);

            if (!geo) {
                for (let i = 0; !geo && i < 3; i++) {
                    await Sleep(2000);
                    console.log('geo', 'Try geo');
                    geo = await GologinUtil.GeoIP(proxyUrl);
                }
            }

            if (!geo) {
                throw new Error('GeoIP failed');
            }
            const [latitude, longitude] = geo.ll;

            const accuracy = geo.accuracy;
            const profileGeolocation = profile.geolocation;
            const tzGeoLocation = {
                latitude,
                longitude,
                accuracy
            };

            profile.geoLocation = {
                mode: profileGeolocation.mode,
                latitude: Number(tzGeoLocation.latitude),
                longitude: Number(tzGeoLocation.longitude),
                accuracy: Number(tzGeoLocation.accuracy),
            };
            console.log('geoLocation', profile.geoLocation);
            profile.webRtc = {
                mode: 'public',
                publicIP: geo.ip,
                localIps: _.get(profile, 'webRTC.localIps', []),
            };
            if (proxyUrl) {
                const proxy = GologinUtil.GetProxyFromProxyUrl(proxyUrl);
                if (!proxy) {
                    throw new Error('proxy is null');
                }
                profile.proxyEnabled = true;
                profile.proxy = {
                    mode: proxy.type,
                    port: Number(proxy.port),
                    autoProxyRegion: geo.country.toLowerCase(),
                    torProxyRegion: geo.country.toLowerCase(),
                    host: proxy.host,
                    username: proxy.username,
                    password: proxy.password
                }
            } else {
                profile.proxyEnabled = false;
            }

            const audioContext = profile.audioContext || {};
            const { mode: audioCtxMode = 'off', noise: audioCtxNoise } = audioContext;
            if (profile.timezone.fillBasedOnIp == false) {
                profile.timezone = { id: profile.timezone.timezone };
            } else {
                profile.timezone = { id: geo.timezone };
            }
            //profile.webgl_noise_value = profile.webGL.noise;
            //profile.get_client_rects_noise = profile.webGL.getClientRectsNoise;
            profile.canvasMode = profile.canvas.mode;
            profile.canvasNoise = profile.canvas.noise;
            profile.audioContext = {
                enable: audioCtxMode !== 'off',
                noiseValue: audioCtxNoise,
            };
            profile.webgl = {
                metadata: {
                    vendor: _.get(profile, 'webGLMetadata.vendor'),
                    renderer: _.get(profile, 'webGLMetadata.renderer'),
                    mode: _.get(profile, 'webGLMetadata.mode') === 'mask',
                }
            };

            profile.custom_fonts = {
                enable: !!fonts?.enableMasking,
            }

            const gologin = GologinUtil.ConvertPreferences(profile);
            gologin.screenWidth = Number(navigator.resolution.split('x')[0]);
            gologin.screenHeight = Number(navigator.resolution.split('x')[1]);
            if (fonts?.enableMasking) {
                const families = fonts?.families || [];
                if (!families.length) {
                    throw new Error('No fonts list provided');
                }
                await GologinUtil.ComposeFonts(families, profilePath, differentOs);
            }
            //const [languages] = navigator.language.split(';');
            if (preferences.gologin == null) {
                preferences.gologin = {};
            }
            preferences.gologin.langHeader = 'en-US,en;q=0.9';
            preferences.gologin.languages = 'en-US,en';
            fs.writeFileSync(path.join(profilePath, 'Default', 'Preferences'), JSON.stringify(_.merge(preferences, {
                gologin
            })));

            const env = {};
            Object.keys(process.env).forEach((key) => {
                env[key] = process.env[key];
            });
            env['TZ'] = geo.timezone;

            let params = [
                `--user-data-dir=${profilePath}`,
                `--password-store=basic`,
                `--disable-encryption`,
                `--tz=${profile.timezone.id}`,
                `--lang=en-US`,
                `--disable-popup-blocking`,
                `--disable-backgrounding-occluded-windows`,
                `--disable-gpu`,
                `--no-sandbox`,
                `--disable-features=InfiniteSessionRestore`,
                `--proxy-bypass-list=*.googlevideo.com;*.ytimg.com;*.gstatic.com;yt3.ggpht.com;fonts.googleapis.com`
            ];

            if (fonts?.enableMasking) {
                let arg = '--font-masking-mode=2';
                if (differentOs) {
                    arg = '--font-masking-mode=3';
                }
                if (profile.os === 'android') {
                    arg = '--font-masking-mode=1';
                }
                params.push(arg);
            }

            if (profile.proxyEnabled) {
                const hr_rules = `"MAP * 0.0.0.0 , EXCLUDE ${profile.proxy.host}"`;
                params.push(`--proxy-server=${profile.proxy.mode}://${profile.proxy.host}:${profile.proxy.port}`);
                params.push(`--host-resolver-rules=${hr_rules}`);
            }

            if (customParam && customParam.length > 0) {
                params = params.concat(customParam);
            }

            const child = childprocess.execFile(ORBITA_BROWSER, params, { env });

            output.error = 0;
            output.data = {
                profilePath: profilePath,
                pid: child.pid,
                email: email
            };
        } catch (e) {
            console.error('StartProfile', e.message);
            output.message = e.message;
        }
    }
    if (output.error == 1 && !output.message) {
        output.message = "Unknow";
    }
    return output;
}

let getGeoBaseProxy = async (proxyUrl) => {
    let resultGeo = {};
    try {
        let geo = await GologinUtil.GeoIP(proxyUrl);

        if (!geo) {
            for (let i = 0; !geo && i < 3; i++) {
                await Sleep(2000);
                console.log('geo', 'Try geo');
                geo = await GologinUtil.GeoIP(proxyUrl);
            }
        }
        if (geo) {
            resultGeo.errorCode = 0;
            resultGeo.geo = geo;
            return resultGeo;
        } else {
            throw new Error('GeoIP failed');
        }
    } catch (error) {
        resultGeo.errorCode = 1;
        resultGeo.message = error.message;
        return resultGeo;
    }
}
let getProxyBaseProxyUrl = (proxyUrl) => {
    if (proxyUrl) {
        proxyUrl = proxyUrl.split(/\r\n|\n/)[0].trim();
        let m = proxyUrl.match(/(.*):\/\/(.*):(.*)@(.*):([\d]{2,5})/);
        if (m && m.length == 6) {
            return {
                host: m[4],
                port: Number(m[5]),
                username: m[2],
                password: m[3],
                type: m[1]
            }
        } else {
            m = proxyUrl.match(/(.*):\/\/(.*):([\d]{2,5})/);
            if (m && m.length == 4) {
                return {
                    host: m[2],
                    port: Number(m[3]),
                    username: '',
                    password: '',
                    type: m[1]
                }
            }
        }
    }
    return null;
}

const GologinUtil = {
    GetProxyFromProxyUrl: function (proxyUrl) {
        if (proxyUrl) {
            proxyUrl = proxyUrl.split(/\r\n|\n/)[0].trim();
            let m = proxyUrl.match(/(.*):\/\/(.*):(.*)@(.*):([\d]{2,5})/);
            if (m && m.length == 6) {
                return {
                    host: m[4],
                    port: Number(m[5]),
                    username: m[2],
                    password: m[3],
                    type: m[1]
                }
            } else {
                m = proxyUrl.match(/(.*):\/\/(.*):([\d]{2,5})/);
                if (m && m.length == 4) {
                    return {
                        host: m[2],
                        port: Number(m[3]),
                        username: '',
                        password: '',
                        type: m[1]
                    }
                }
            }
        }
        return null;
    },
    GeoIP: async (proxyUrl) => {
        return await Request.Get('https://time.gologin.com/timezone', { proxyUrl: proxyUrl, timeout: 15000 });
    },
    ConvertPreferences: (preferences) => {
        if (_.get(preferences, 'navigator.userAgent')) {
            preferences.userAgent = _.get(preferences, 'navigator.userAgent');
        }

        if (_.get(preferences, 'navigator.doNotTrack')) {
            preferences.doNotTrack = _.get(preferences, 'navigator.doNotTrack');
        }

        if (_.get(preferences, 'navigator.hardwareConcurrency')) {
            preferences.hardwareConcurrency = _.get(preferences, 'navigator.hardwareConcurrency');
        }

        if (_.get(preferences, 'navigator.language')) {
            preferences.language = _.get(preferences, 'navigator.language');
        }
        if (_.get(preferences, 'navigator.maxTouchPoints')) {
            preferences.navigator.max_touch_points = _.get(preferences, 'navigator.maxTouchPoints');
        }

        if (_.get(preferences, 'isM1')) {
            preferences.is_m1 = _.get(preferences, 'isM1');
        }

        if (_.get(preferences, 'os') == 'android') {
            const devicePixelRatio = _.get(preferences, "devicePixelRatio");
            const deviceScaleFactorCeil = Math.ceil(devicePixelRatio || 3.5);
            let deviceScaleFactor = devicePixelRatio;
            if (deviceScaleFactorCeil === devicePixelRatio) {
                deviceScaleFactor += 0.00000001;
            }

            preferences.mobile = {
                enable: true,
                width: Number(_.get(preferences, 'navigator.resolution').split('x')[0]),
                height: Number(_.get(preferences, 'navigator.resolution').split('x')[1]),
                device_scale_factor: deviceScaleFactor,
            }
        }

        preferences.mediaDevices = {
            enable: preferences.mediaDevices.enableMasking,
            videoInputs: preferences.mediaDevices.videoInputs,
            audioInputs: preferences.mediaDevices.audioInputs,
            audioOutputs: preferences.mediaDevices.audioOutputs,
        }

        return preferences;
    },
    DownloadFonts: async (fontsList = [], profilePath) => {
        if (!fontsList.length) {
            return;
        }
        const browserFontsPath = path.join(userHomeDir, 'vannguyenlp', 'browser', 'fonts');
        if (!fs.existsSync(browserFontsPath)) {
            fs.mkdirSync(browserFontsPath, { recursive: true });
        }

        const files = fs.readdirSync(browserFontsPath);
        const fontsToDownload = fontsList.filter(font => !files.includes(font));

        if (fontsToDownload.length > 0) {
            let download = fontsToDownload.map(font => Request.Download(FONTS_URL + font, browserFontsPath, font))
            if (download.length) {
                let files = await Promise.all(download);
                await Sleep(300);
                fontsList.map((font) => fs.copyFileSync(path.join(browserFontsPath, font), path.join(profilePath, 'fonts', font)));
            }
        }
    },
    CopyFontConfigFile: (profilePath) => {
        if (!profilePath) {
            return;
        }
        const fileContent = fs.readFileSync(path.resolve(__dirname, 'fonts_config'), 'utf-8');
        const result = fileContent.replace(/\$\$GOLOGIN_FONTS\$\$/g, path.join(profilePath, 'fonts'));
        const defaultFolderPath = path.join(profilePath, 'Default');
        if (!fs.existsSync(defaultFolderPath)) {
            fs.mkdirSync(defaultFolderPath, { recursive: true });
        }
        fs.writeFileSync(path.join(defaultFolderPath, 'fonts_config'), result);
    },
    ComposeFonts: async (fontsList = [], profilePath, differentOs = false) => {
        if (!(fontsList.length && profilePath)) {
            return;
        }
        const fontsToDownload = fontsCollection.filter(elem => fontsList.includes(elem.value)).reduce((res, elem) => res.concat(elem.fileNames || []), []);
        if (differentOs && !fontsToDownload.length) {
            throw new Error('No fonts to download found. Use getAvailableFonts() method and set some fonts from this list');
        }
        fontsToDownload.push('LICENSE.txt');
        fontsToDownload.push('OFL.txt');
        const pathToFontsDir = path.join(profilePath, 'fonts');
        if (fs.existsSync(pathToFontsDir)) {
            fs.rmSync(pathToFontsDir, { recursive: true });
        }
        fs.mkdirSync(pathToFontsDir, { recursive: true });
        await GologinUtil.DownloadFonts(fontsToDownload, profilePath);
        if (process.platform === 'linux') {
            GologinUtil.CopyFontConfigFile(profilePath);
        }
    },
    RandomFingerprint: async (proxyUrl, token, os = 'win') => {
        try {
            let fingerprint = await Request.Get(`${API_URL}/browser/fingerprint?os=${os}`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
                proxyUrl: proxyUrl
            });
            return fingerprint;
        } catch (e) {
            console.error('RandomFingerprint', e.message);
        }
        return null;
    }
}

module.exports = {
    StartProfile,
    CreateProfile,
    GetNewToken,
    getGeoBaseProxy,
    getProxyBaseProxyUrl
}