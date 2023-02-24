const debug = require('debug')('gologin');
const _ = require('lodash');
const requests = require('requestretry').defaults({ timeout: 60000 });
const fs = require('fs');
const os = require('os');
const util = require('util');
const rimraf = util.promisify(require('rimraf'));
const { access, unlink, writeFile, readFile } = require('fs').promises;
const exec = util.promisify(require('child_process').exec);
const { spawn, execFile } = require('child_process');
const ProxyAgent = require('simple-proxy-agent');
const decompress = require('decompress');
const decompressUnzip = require('decompress-unzip');
const path = require('path');
const zipdir = require('zip-dir');
const https = require('https');

const BrowserChecker = require('./browser-checker');
const { BrowserUserDataManager } = require('./browser-user-data-manager');
const { CookiesManager } = require('./cookies-manager');
const fontsCollection = require('./fonts');
const ExtensionsManager = require('./extensions-manager');
const AbortController = require("abort-controller");
const HttpsProxyAgent = require('https-proxy-agent');
const { SocksProxyAgent } = require('socks-proxy-agent');
const fetch = require('node-fetch');
const userHomeDir = os.homedir();

const SEPARATOR = path.sep;
const API_URL = 'https://api.gologin.com';
// const API_URL = 'http://localhost:3002';
const OS_PLATFORM = process.platform;

// process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

const delay = (time) => new Promise((resolve) => setTimeout(resolve, time));

const getAgent = (proxyUrl) => {
  if (proxyUrl.startsWith("http")) {
    return new HttpsProxyAgent(proxyUrl);
  } else if (proxyUrl.startsWith("socks")) {
    return new SocksProxyAgent(proxyUrl.endsWith("/") ? proxyUrl : proxyUrl + "/");
  }
  return null;
}

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
};

class GoLogin {
  constructor(options = {}) {
    this.is_remote = options.remote || false;
    this.access_token = options.token;
    this.profile_id = options.profile_id;
    this.password = options.password;
    this.extra_params = options.extra_params;
    this.executablePath = options.executablePath;
    this.vnc_port = options.vncPort;
    this.fontsMasking = false;
    this.is_active = false;
    this.is_stopping = false;
    this.differentOs = false;
    this.profileOs = 'lin';
    this.waitWebsocket = true;
    if (options.waitWebsocket === false) {
      this.waitWebsocket = false;
    }
    this.tmpdir = os.tmpdir();
    this.autoUpdateBrowser = !!options.autoUpdateBrowser;
    this.browserChecker = new BrowserChecker(options.skipOrbitaHashChecking);
    this.uploadCookiesToServer = options.uploadCookiesToServer || false;
    this.writeCookesFromServer = options.writeCookesFromServer;
    this.remote_debugging_port = options.remote_debugging_port || 0;
    this.timezone = options.timezone;
    this.extensionPathsToInstall = [];
    if (options.tmpdir) {
      this.tmpdir = options.tmpdir;
      if (!fs.existsSync(this.tmpdir)) {
        debug('making tmpdir', this.tmpdir);
        fs.mkdirSync(this.tmpdir, { recursive: true })
      }
    }

    this.cookiesFilePath = path.join(this.tmpdir, `gologin_profile_${this.profile_id}`, 'Default', 'Network', 'Cookies');
    this.profile_zip_path = path.join(this.tmpdir, `gologin_${this.profile_id}.zip`);
    debug('INIT GOLOGIN', this.profile_id);
  }

  async checkBrowser() { return this.browserChecker.checkBrowser(this.autoUpdateBrowser) }

  async setProfileId(profile_id) {
    this.profile_id = profile_id;
    this.cookiesFilePath = path.join(this.tmpdir, `gologin_profile_${this.profile_id}`, 'Default', 'Network', 'Cookies');
    this.profile_zip_path = path.join(this.tmpdir, `gologin_${this.profile_id}.zip`);
  }

  async getToken(username, password) {
    let data = await requests.post(`${API_URL}/user/login`, {
      json: {
        username: username,
        password: password
      }
    });

    if (!Reflect.has(data, 'body.access_token')) {
      throw new Error(`gologin auth failed with status code, ${data.statusCode} DATA  ${JSON.stringify(data)}`);
    }
  }

  async getNewFingerPrint(os) {
    debug('GETTING FINGERPRINT');

    const fpResponse = await requests.get(`${API_URL}/browser/fingerprint?os=${os}`, {
      json: true,
      headers: {
        'Authorization': `Bearer ${this.access_token}`,
        'User-Agent': 'gologin-api',
      }
    })

    return fpResponse?.body || {};
  }

  async profiles() {
    const profilesResponse = await requests.get(`${API_URL}/browser/v2`, {
      headers: {
        'Authorization': `Bearer ${this.access_token}`,
        'User-Agent': 'gologin-api',

      }
    })

    if (profilesResponse.statusCode !== 200) {
      throw new Error(`Gologin /browser response error`);
    }

    return JSON.parse(profilesResponse.body);
  }

  async getProfile(profile_id) {
    const id = profile_id || this.profile_id;
    debug('getProfile', this.access_token, id);
    const profileResponse = await requests.get(`${API_URL}/browser/${id}`, {
      headers: {
        'Authorization': `Bearer ${this.access_token}`
      }
    })
    debug("profileResponse", profileResponse.statusCode, profileResponse.body);


    if (profileResponse.statusCode === 404) {
      throw new Error(JSON.parse(profileResponse.body).message);
    }

    if (profileResponse.statusCode === 403) {
      throw new Error(JSON.parse(profileResponse.body).message);
    }

    if (profileResponse.statusCode !== 200) {
      throw new Error(`Gologin /browser/${id} response error ${profileResponse.statusCode} INVALID TOKEN OR PROFILE NOT FOUND`);
    }

    if (profileResponse.statusCode === 401) {
      throw new Error("invalid token");
    }


    return JSON.parse(profileResponse.body);
  }

  async emptyProfile() {
    return readFile(path.resolve(__dirname, 'gologin_zeroprofile.b64')).then(res => res.toString());
  }

  async getProfileS3(s3path) {
    if (!s3path) {
      throw new Error('s3path not found');
    }

    const token = this.access_token;
    debug('getProfileS3 token=', token, 'profile=', this.profile_id, 's3path=', s3path);

    const s3url = `https://gprofiles.gologin.com/${s3path}`.replace(/\s+/mg, '+');
    debug('loading profile from public s3 bucket, url=', s3url);
    const profileResponse = await requests.get(s3url, {
      encoding: null
    });

    if (profileResponse.statusCode !== 200) {
      debug(`Gologin S3 BUCKET ${s3url} response error ${profileResponse.statusCode}  - use empty`);
      return '';
    }

    return Buffer.from(profileResponse.body);
  }

  async postFile(fileName, fileBuff) {
    debug('POSTING FILE', fileBuff.length);
    debug('Getting signed URL for S3');
    const apiUrl = `${API_URL}/browser/${this.profile_id}/storage-signature`;

    const signedUrl = await requests.get(apiUrl, {
      headers: {
        Authorization: `Bearer ${this.access_token}`,
        'user-agent': 'gologin-api',
      },
      maxAttempts: 3,
      retryDelay: 2000,
      timeout: 10 * 1000,
      fullResponse: false,
    });

    const [uploadedProfileUrl] = signedUrl.split('?');

    console.log('Uploading profile by signed URL to S3');
    const bodyBufferBiteLength = Buffer.byteLength(fileBuff);
    console.log('BUFFER SIZE', bodyBufferBiteLength);

    await requests.put(signedUrl, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Length': bodyBufferBiteLength,
      },
      body: fileBuff,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      maxAttempts: 3,
      retryDelay: 2000,
      timeout: 30 * 1000,
      fullResponse: false,
    });

    const uploadedProfileMetadata = await requests.head(uploadedProfileUrl, {
      maxAttempts: 3,
      retryDelay: 2000,
      timeout: 10 * 1000,
      fullResponse: true,
    });

    const uploadedFileLength = +uploadedProfileMetadata.headers['content-length'];
    if (uploadedFileLength !== bodyBufferBiteLength) {
      console.log('Uploaded file is incorrect. Retry with China File size:', uploadedFileLength);
      throw new Error('Uploaded file is incorrect. Retry with China File size: ' + uploadedFileLength);
    }

    console.log('Profile has been uploaded to S3 successfully');
  }

  async emptyProfileFolder() {
    debug('get emptyProfileFolder');
    const profile = await readFile(path.resolve(__dirname, 'zero_profile.zip'));
    debug('emptyProfileFolder LENGTH ::', profile.length);
    return profile;
  }

  convertPreferences(preferences) {
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
        width: parseInt(this.resolution.width, 10),
        height: parseInt(this.resolution.height, 10),
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
  }

  async createBrowserExtension() {
    const that = this;
    debug('start createBrowserExtension')
    await rimraf(this.orbitaExtensionPath());
    const extPath = this.orbitaExtensionPath();
    debug('extension folder sanitized');
    const extension_source = path.resolve(__dirname, `gologin-browser-ext.zip`);
    await decompress(extension_source, extPath,
      {
        plugins: [decompressUnzip()],
        filter: file => !file.path.endsWith('/'),
      }
    )
      .then(() => {
        debug('extraction done');
        debug('create uid.json');
        return writeFile(path.join(extPath, 'uid.json'), JSON.stringify({ uid: that.profile_id }, null, 2))
          .then(() => extPath);
      })
      .catch(async (e) => {
        debug('orbita extension error', e);
      });

    debug('createBrowserExtension done');
  }

  extractProfile(path, zipfile) {
    debug(`extactProfile ${zipfile}, ${path}`);
    return decompress(zipfile, path,
      {
        plugins: [decompressUnzip()],
        filter: file => !file.path.endsWith('/'),
      }
    );
  }

  async createStartup(local = false) {
    const profilePath = path.join(this.tmpdir, `gologin_profile_${this.profile_id}`);
    let profile;
    let profile_folder;
    await rimraf(profilePath);
    debug('-', profilePath, 'dropped');
    profile = await this.getProfile();
    const { navigator = {}, fonts, os: profileOs } = profile;
    this.fontsMasking = fonts?.enableMasking;
    this.profileOs = profileOs;
    this.differentOs =
      profileOs !== 'android' && (
        OS_PLATFORM === 'win32' && profileOs !== 'win' ||
        OS_PLATFORM === 'darwin' && profileOs !== 'mac' ||
        OS_PLATFORM === 'linux' && profileOs !== 'lin'
      );

    const {
      resolution = '1920x1080',
      language = 'en-US,en;q=0.9',
    } = navigator;
    this.language = language;
    const [screenWidth, screenHeight] = resolution.split('x');
    this.resolution = {
      width: parseInt(screenWidth, 10),
      height: parseInt(screenHeight, 10),
    };

    const profileZipExists = await access(this.profile_zip_path).then(() => true).catch(() => false);
    if (!(local && profileZipExists)) {
      try {
        profile_folder = await this.getProfileS3(_.get(profile, 's3Path', ''));
      }
      catch (e) {
        debug('Cannot get profile - using empty', e);
      }

      debug('FILE READY', this.profile_zip_path);
      if (!profile_folder.length) {
        profile_folder = await this.emptyProfileFolder();
      }

      await writeFile(this.profile_zip_path, profile_folder);

      debug('PROFILE LENGTH', profile_folder.length);
    } else {
      debug('PROFILE LOCAL HAVING', this.profile_zip_path);
    }

    debug('Cleaning up..', profilePath);

    try {
      await this.extractProfile(profilePath, this.profile_zip_path);
      debug('extraction done');
    } catch (e) {
      console.trace(e);
      profile_folder = await this.emptyProfileFolder();
      await writeFile(this.profile_zip_path, profile_folder);
      await this.extractProfile(profilePath, this.profile_zip_path);
    }

    const singletonLockPath = path.join(profilePath, 'SingletonLock');
    const singletonLockExists = await access(singletonLockPath).then(() => true).catch(() => false);
    if (singletonLockExists) {
      debug('removing SingletonLock');
      await unlink(singletonLockPath);
      debug('SingletonLock removed');
    }

    const pref_file_name = path.join(profilePath, 'Default', 'Preferences');
    debug('reading', pref_file_name);

    const prefFileExists = await access(pref_file_name).then(() => true).catch(() => false);
    if (!prefFileExists) {
      debug('Preferences file not exists waiting', pref_file_name, '. Using empty profile');
      profile_folder = await this.emptyProfileFolder();
      await writeFile(this.profile_zip_path, profile_folder);
      await this.extractProfile(profilePath, this.profile_zip_path);
    }

    const preferences_raw = await readFile(pref_file_name);
    let preferences = JSON.parse(preferences_raw.toString());
    let proxy = _.get(profile, 'proxy');
    let name = _.get(profile, 'name');
    const chromeExtensions = _.get(profile, 'chromeExtensions') || [];
    const userChromeExtensions = _.get(profile, 'userChromeExtensions') || [];
    const allExtensions = [...chromeExtensions, ...userChromeExtensions];

    if (allExtensions.length) {
      const ExtensionsManagerInst = new ExtensionsManager();
      ExtensionsManagerInst.apiUrl = API_URL;
      await ExtensionsManagerInst.init()
        .then(() => ExtensionsManagerInst.updateExtensions())
        .catch(() => { });
      ExtensionsManagerInst.accessToken = this.access_token;

      await ExtensionsManagerInst.getExtensionsPolicies();
      let profileExtensionsCheckRes = [];

      if (ExtensionsManagerInst.useLocalExtStorage) {
        const promises = [
          ExtensionsManagerInst.checkChromeExtensions(allExtensions)
            .then(res => ({ profileExtensionsCheckRes: res }))
            .catch((e) => {
              console.log('checkChromeExtensions error: ', e);
              return { profileExtensionsCheckRes: [] };
            }),
          ExtensionsManagerInst.checkLocalUserChromeExtensions(userChromeExtensions)
            .then(res => ({ profileUserExtensionsCheckRes: res }))
            .catch((error) => {
              console.log('checkUserChromeExtensions error: ', error);
              return null;
            }),
        ];
        const extensionsResult = await Promise.all(promises);

        const profileExtensionPathRes = extensionsResult.find(el => 'profileExtensionsCheckRes' in el) || {};
        const profileUserExtensionPathRes = extensionsResult.find(el => 'profileUserExtensionsCheckRes' in el);
        profileExtensionsCheckRes =
          (profileExtensionPathRes?.profileExtensionsCheckRes || []).concat(profileUserExtensionPathRes?.profileUserExtensionsCheckRes || []);
      }

      let extSettings;
      if (ExtensionsManagerInst.useLocalExtStorage) {
        extSettings = await BrowserUserDataManager.setExtPathsAndRemoveDeleted(preferences, profileExtensionsCheckRes, this.profile_id);
      } else {
        const originalExtensionsFolder = path.join(profilePath, 'Default', 'Extensions');
        extSettings = await BrowserUserDataManager.setOriginalExtPaths(preferences, originalExtensionsFolder);
      }

      this.extensionPathsToInstall =
        ExtensionsManagerInst.getExtensionsToInstall(extSettings, profileExtensionsCheckRes);

      if (extSettings) {
        const currentExtSettings = preferences.extensions || {};
        currentExtSettings.settings = extSettings
        preferences.extensions = currentExtSettings;
      }
    }

    if (proxy.mode === 'gologin' || proxy.mode === 'tor') {
      const autoProxyServer = _.get(profile, 'autoProxyServer');
      const splittedAutoProxyServer = autoProxyServer.split('://');
      const splittedProxyAddress = splittedAutoProxyServer[1].split(':');
      const port = splittedProxyAddress[1];

      proxy = {
        'mode': splittedAutoProxyServer[0],
        'host': splittedProxyAddress[0],
        port,
        'username': _.get(profile, 'autoProxyUsername'),
        'password': _.get(profile, 'autoProxyPassword'),
      }

      profile.proxy.username = _.get(profile, 'autoProxyUsername');
      profile.proxy.password = _.get(profile, 'autoProxyPassword');
    }
    // console.log('proxy=', proxy);

    if (proxy.mode === 'geolocation') {
      proxy.mode = 'http';
    }

    if (proxy.mode === 'none') {
      proxy = null;
    }
    this.proxy = proxy;
    await this.getTimeZone(proxy).catch((e) => {
      // await this.getTimeZone(proxy).catch((e) => {
      console.error('Proxy Error. Check it and try again.');
      throw e;
    });

    const [latitude, longitude] = this._tz.ll;
    const accuracy = this._tz.accuracy;

    const profileGeolocation = profile.geolocation;
    const tzGeoLocation = {
      latitude,
      longitude,
      accuracy
    };
    profile.geoLocation = this.getGeolocationParams(profileGeolocation, tzGeoLocation);
    profile.name = name;
    profile.name_base64 = Buffer.from(name).toString('base64');
    profile.profile_id = this.profile_id;

    profile.webRtc = {
      mode: _.get(profile, 'webRTC.mode') === 'alerted' ? 'public' : _.get(profile, 'webRTC.mode'),
      publicIP: _.get(profile, 'webRTC.fillBasedOnIp') ? this._tz.ip : _.get(profile, 'webRTC.publicIp'),
      localIps: _.get(profile, 'webRTC.localIps', []),
    };

    debug('profile.webRtc=', profile.webRtc);
    debug('profile.timezone=', profile.timezone);
    debug('profile.mediaDevices=', profile.mediaDevices);

    const audioContext = profile.audioContext || {};
    const { mode: audioCtxMode = 'off', noise: audioCtxNoise } = audioContext;
    if (profile.timezone.fillBasedOnIp == false) {
      profile.timezone = { id: profile.timezone.timezone };
    } else {
      profile.timezone = { id: this._tz.timezone };
    }
    profile.webgl_noise_value = profile.webGL.noise;
    profile.get_client_rects_noise = profile.webGL.getClientRectsNoise;
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

    const gologin = this.convertPreferences(profile);

    debug(`Writing profile for screenWidth ${profilePath}`, JSON.stringify(gologin));
    gologin.screenWidth = this.resolution.width;
    gologin.screenHeight = this.resolution.height;
    debug("writeCookesFromServer", this.writeCookesFromServer)
    if (this.writeCookesFromServer) {
      await this.writeCookiesToFile();
    }

    if (this.fontsMasking) {
      const families = fonts?.families || [];
      if (!families.length) {
        throw new Error('No fonts list provided');
      }

      try {
        await BrowserUserDataManager.composeFonts(families, profilePath, this.differentOs);
      } catch (e) {
        console.trace(e);
      }
    }

    const [languages] = this.language.split(';');

    if (preferences.gologin == null) {
      preferences.gologin = {};
    }

    preferences.gologin.langHeader = gologin.language;
    preferences.gologin.languages = languages;
    // debug("convertedPreferences=", preferences.gologin)
    await writeFile(path.join(profilePath, 'Default', 'Preferences'), JSON.stringify(_.merge(preferences, {
      gologin
    })));

    // console.log('gologin=', _.merge(preferences, {
    //   gologin
    // }));

    debug('Profile ready. Path: ', profilePath, 'PROXY', JSON.stringify(_.get(preferences, 'gologin.proxy')));
    return profilePath;
  }

  async commitProfile() {
    const dataBuff = await this.getProfileDataToUpdate();

    debug('begin updating', dataBuff.length);
    if (!dataBuff.length) {
      debug('WARN: profile zip data empty - SKIPPING PROFILE COMMIT');

      return;
    }

    try {
      debug('Patching profile');
      await this.postFile('profile', dataBuff);
    }
    catch (e) {
      debug('CANNOT COMMIT PROFILE', e);
    }

    debug('COMMIT COMPLETED');
  }

  profilePath() {
    return path.join(this.tmpdir, `gologin_profile_${this.profile_id}`);
  }

  orbitaExtensionPath() {
    return path.join(this.tmpdir, `orbita_extension_${this.profile_id}`);
  }

  getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  async checkPortAvailable(port) {
    debug('CHECKING PORT AVAILABLE', port);

    try {
      const { stdout, stderr } = await exec(`lsof -i:${port}`);
      if (stdout && stdout.match(/LISTEN/gmi)) {
        debug(`PORT ${port} IS BUSY`)
        return false;
      }
    } catch (e) { }
    debug(`PORT ${port} IS OPEN`);

    return true;
  }

  async getRandomPort() {
    let port = this.getRandomInt(20000, 40000);
    let port_available = this.checkPortAvailable(port);
    while (!port_available) {
      port = this.getRandomInt(20000, 40000);
      port_available = await this.checkPortAvailable(port);
    }
    return port;
  }

  async getTimeZone(proxy) {
    console.log(">>>>>>>>>>>>>>>>>>>>>>>>>> proxy: ", proxy);
    debug('getting timeZone proxy=', proxy);
    if (this.timezone) {
      debug('getTimeZone from options', this.timezone);
      this._tz = this.timezone;
      return this._tz.timezone;
    }

    let data = null;
    if (proxy !== null && proxy.mode !== "none") {
      if (proxy.mode.includes('socks')) {

        for (let i = 0; i < 5; i++) {
          try {
            debug('getting timeZone socks try', i + 1);
            return this.getTimezoneWithSocks(proxy);
          } catch (e) {
            console.log(e.message);
          }
        }
        throw new Error(`Socks proxy connection timed out`);
      }

      const proxyUrl = `${proxy.mode}://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
      debug('getTimeZone start https://time.gologin.com/timezone', proxyUrl);
      // data = await requests.get('https://time.gologin.com/timezone', { proxy: proxyUrl, timeout: 15000 });
      data = await requests.get('https://time.gologin.com/timezone', { proxyUrl: proxyUrl, timeout: 15000 });
    } else {
      data = await requests.get('https://time.gologin.com/timezone', { timeout: 20 * 1000, maxAttempts: 5 });
    }
    // debug('getTimeZone finish', data.body);
    this._tz = data;
    this._tz = JSON.parse(data.body);
    return this._tz.timezone;
  }

  async getTimezoneWithSocks(params) {
    const { mode = 'http', host, port, username = '', password = '' } = params;
    let body;

    let proxy = mode + '://';
    if (username) {
      const resultPassword = password ? ':' + password + '@' : '@';
      proxy += username + resultPassword;
    }
    proxy += host + ':' + port;

    const agent = new ProxyAgent(proxy, { tunnel: true, timeout: 10000 });

    const checkData = await new Promise((resolve, reject) => {
      https.get('https://time.gologin.com/timezone', { agent }, (res) => {
        let resultResponse = '';
        res.on('data', (data) => resultResponse += data);

        res.on('end', () => {
          let parsedData;
          try {
            parsedData = JSON.parse(resultResponse);
          } catch (e) {
            reject(e);
          }

          resolve({
            ...res,
            body: parsedData,
          });
        });
      }).on('error', (err) => reject(err));
    });

    // console.log('checkData:', checkData);
    body = checkData.body || {};
    if (!body.ip && checkData.statusCode.toString().startsWith('4')) {
      throw checkData;
    }
    debug('getTimeZone finish', body.body);
    this._tz = body;
    return this._tz.timezone;
  }

  async spawnArguments() {
    const profile_path = this.profilePath();

    let proxy = this.proxy;
    proxy = `${proxy.mode}://${proxy.host}:${proxy.port}`;

    const env = {};
    Object.keys(process.env).forEach((key) => {
      env[key] = process.env[key];
    });
    const tz = await this.getTimeZone(this.proxy).catch((e) => {
      console.error('Proxy Error. Check it and try again.');
      throw e;
    });
    env['TZ'] = tz;

    let params = [`--proxy-server=${proxy}`, `--user-data-dir=${profile_path}`, `--password-store=basic`, `--tz=${tz}`, `--lang=en`]
    if (Array.isArray(this.extra_params) && this.extra_params.length) {
      params = params.concat(this.extra_params);
    }

    if (this.remote_debugging_port) {
      params.push(`--remote-debugging-port=${remote_debugging_port}`);
    }

    return params;
  }

  async spawnBrowser() {
    let remote_debugging_port = this.remote_debugging_port;
    if (!remote_debugging_port) {
      remote_debugging_port = await this.getRandomPort();
    }

    const profile_path = this.profilePath();

    let proxy = this.proxy;
    let proxy_host = '';
    if (proxy) {
      proxy_host = this.proxy.host;
      proxy = `${proxy.mode}://${proxy.host}:${proxy.port}`;
    }

    this.port = remote_debugging_port;

    const ORBITA_BROWSER = this.executablePath || this.browserChecker.getOrbitaPath;
    debug(`ORBITA_BROWSER=${ORBITA_BROWSER}`)
    const env = {};
    Object.keys(process.env).forEach((key) => {
      env[key] = process.env[key];
    });
    const tz = await this.getTimeZone(this.proxy).catch((e) => {
      console.error('Proxy Error. Check it and try again.');
      throw e;
    });
    env['TZ'] = tz;

    if (this.vnc_port) {
      const script_path = path.resolve(__dirname, './run.sh');
      debug('RUNNING', script_path, ORBITA_BROWSER, remote_debugging_port, proxy, profile_path, this.vnc_port);
      execFile(
        script_path,
        [ORBITA_BROWSER, remote_debugging_port, proxy, profile_path, this.vnc_port, tz],
        { env }
      );
    } else {
      const [splittedLangs] = this.language.split(';');
      let [browserLang] = splittedLangs.split(',');
      if (process.platform === 'darwin') {
        browserLang = 'en-US';
      }

      let params = [
        `--remote-debugging-port=${remote_debugging_port}`,
        `--disable-web-security`,
        `--disable-infobars`,
        `--user-data-dir=${profile_path}`,
        `--password-store=basic`,
        `--tz=${tz}`,
        `--lang=${browserLang}`
        // `--disable-site-isolation-trials`,

        // `--allow-file-access-from-files`,
        // `--allow-file-access`,
        // `--allow-cross-origin-auth-prompt`,
      ];

      if (this.extensionPathsToInstall.length) {
        if (Array.isArray(this.extra_params) && this.extra_params.length) {
          this.extra_params.forEach((param, index) => {
            if (!param.includes('--load-extension=')) {
              return;
            }

            const [_, extPathsString] = param.split('=');
            const extPathsArray = extPathsString.split(',');
            this.extensionPathsToInstall = [...this.extensionPathsToInstall, ...extPathsArray];
            this.extra_params.splice(index, 1);
          });
        }
        params.push(`--load-extension=${this.extensionPathsToInstall.join(',')}`);
      }

      if (this.fontsMasking) {
        let arg = '--font-masking-mode=2';
        if (this.differentOs) {
          arg = '--font-masking-mode=3';
        }
        if (this.profileOs === 'android') {
          arg = '--font-masking-mode=1';
        }

        params.push(arg);
      }

      if (proxy) {
        const hr_rules = `"MAP * 0.0.0.0 , EXCLUDE ${proxy_host}"`;
        params.push(`--proxy-server=${proxy}`);
        params.push(`--host-resolver-rules=${hr_rules}`);
      }

      if (Array.isArray(this.extra_params) && this.extra_params.length) {
        params = params.concat(this.extra_params);
      }
      let extensionPath = path.join(userHomeDir, 'extension', 'Youtube-Premium');
      params.push(`--load-extension=${extensionPath}`);
      console.log(params)
      const child = execFile(ORBITA_BROWSER, params, { env });
      // const child = spawn(ORBITA_BROWSER, params, { env, shell: true });
      child.stdout.on('data', (data) => debug(data.toString()));
      debug('SPAWN CMD', ORBITA_BROWSER, params.join(" "));
    }


    if (this.waitWebsocket) {
      debug('GETTING WS URL FROM BROWSER');
      let data = await requests.get(`http://127.0.0.1:${remote_debugging_port}/json/version`, { json: true });

      debug('WS IS', _.get(data, 'body.webSocketDebuggerUrl', ''))
      this.is_active = true;

      return _.get(data, 'body.webSocketDebuggerUrl', '');
    }
    return '';
  }

  async createStartupAndSpawnBrowser() {
    await this.createStartup();
    return this.spawnBrowser();
  }

  async clearProfileFiles() {
    await rimraf(path.join(this.tmpdir, `gologin_profile_${this.profile_id}`));
    await rimraf(path.join(this.tmpdir, `gologin_${this.profile_id}_upload.zip`));
  }

  async stopAndCommit(options, local = false) {
    if (this.is_stopping) {
      return true;
    }
    const is_posting = options.posting ||
      options.postings || // backward compability
      false;

    if (this.uploadCookiesToServer) {
      await this.uploadProfileCookiesToServer();
    }

    this.is_stopping = true;
    await this.sanitizeProfile();

    if (is_posting) {
      await this.commitProfile();
    }

    this.is_stopping = false;
    this.is_active = false;
    await delay(3000);
    await this.clearProfileFiles();

    if (!local) {
      await rimraf(path.join(this.tmpdir, `gologin_${this.profile_id}.zip`));
    }
    debug(`PROFILE ${this.profile_id} STOPPED AND CLEAR`);
    return false;
  }


  async stopBrowser() {
    if (!this.port) {
      throw new Error('Empty GoLogin port');
    }
    const ls = await spawn('fuser',
      [
        '-k TERM',
        `-n tcp ${this.port}`
      ],
      {
        shell: true
      }
    );
    debug('browser killed');
  }


  async sanitizeProfile() {
    const remove_dirs = [
      `${SEPARATOR}Default${SEPARATOR}Cache`,
      `${SEPARATOR}Default${SEPARATOR}Service Worker${SEPARATOR}CacheStorage`,
      `${SEPARATOR}Default${SEPARATOR}Code Cache`,
      `${SEPARATOR}Default${SEPARATOR}GPUCache`,
      `${SEPARATOR}GrShaderCache`,
      `${SEPARATOR}ShaderCache`,
      `${SEPARATOR}biahpgbdmdkfgndcmfiipgcebobojjkp`,
      `${SEPARATOR}afalakplffnnnlkncjhbmahjfjhmlkal`,
      `${SEPARATOR}cffkpbalmllkdoenhmdmpbkajipdjfam`,
      `${SEPARATOR}Dictionaries`,
      `${SEPARATOR}enkheaiicpeffbfgjiklngbpkilnbkoi`,
      `${SEPARATOR}oofiananboodjbbmdelgdommihjbkfag`,
      `${SEPARATOR}SafetyTips`,
      `${SEPARATOR}fonts`,
      `${SEPARATOR}BrowserMetrics`,
      `${SEPARATOR}BrowserMetrics-spare.pma`,
    ];
    const that = this;

    await Promise.all(remove_dirs.map(d => {
      const path_to_remove = `${that.profilePath()}${d}`
      return new Promise(resolve => {
        debug('DROPPING', path_to_remove);
        rimraf(path_to_remove, { maxBusyTries: 100 }, (e) => {
          // debug('DROPPING RESULT', e);
          resolve();
        });
      });
    }))
  }

  async getProfileDataToUpdate() {
    const zipPath = path.join(this.tmpdir, `gologin_${this.profile_id}_upload.zip`);
    const zipExists = await access(zipPath).then(() => true).catch(() => false);
    if (zipExists) {
      await unlink(zipPath);
    }

    await this.sanitizeProfile();
    debug('profile sanitized');

    const profilePath = this.profilePath();
    const fileBuff = await new Promise((resolve, reject) => zipdir(profilePath,
      {
        saveTo: zipPath,
        filter: (path) => !/RunningChromeVersion/.test(path),
      }, (err, buffer) => {
        if (err) {
          reject(err);
          return;
        }

        resolve(buffer);
      })
    )

    debug('PROFILE ZIP CREATED', profilePath, zipPath);
    return fileBuff;
  }

  async profileExists() {
    const profileResponse = await requests.post(`${API_URL}/browser`, {
      headers: {
        'Authorization': `Bearer ${this.access_token}`
      },
      json: {

      }
    })

    if (profileResponse.statusCode !== 200) {
      return false;
    }
    debug('profile is', profileResponse.body);
    return true;
  }


  async getRandomFingerprint(options) {
    let os = 'lin';

    if (options.os) {
      os = options.os;
    }

    let fingerprint = await requests.get(`${API_URL}/browser/fingerprint?os=${os}`, {
      headers: {
        'Authorization': `Bearer ${this.access_token}`,
        'User-Agent': 'gologin-api',
      }
    });

    return JSON.parse(fingerprint.body);
  }

  async create(options) {
    debug('createProfile', options);

    const fingerprint = await this.getRandomFingerprint(options);

    debug("fingerprint=", fingerprint)

    if (fingerprint.statusCode === 500) {
      throw new Error("no valid random fingerprint check os param");
    }

    if (fingerprint.statusCode === 401) {
      throw new Error("invalid token");
    }

    const { navigator, fonts, webGLMetadata, webRTC } = fingerprint;
    let deviceMemory = navigator.deviceMemory || 2;
    if (deviceMemory < 1) {
      deviceMemory = 1;
    }
    navigator.deviceMemory = deviceMemory * 1024;
    webGLMetadata.mode = webGLMetadata.mode === 'noise' ? 'mask' : 'off';

    const json = {
      ...fingerprint,
      navigator,
      webGLMetadata,
      browserType: 'chrome',
      name: 'default_name',
      notes: 'auto generated',
      fonts: {
        families: fonts,
      },
      webRTC: {
        ...webRTC,
        mode: 'alerted',
      },
    };
    let user_agent = options.navigator?.userAgent;
    let orig_user_agent = json.navigator.userAgent;
    Object.keys(options).map((e) => { json[e] = options[e] });
    if (user_agent === 'random') {
      json.navigator.userAgent = orig_user_agent;
    }
    console.log('profileOptions', json);
    const response = await requests.post(`${API_URL}/browser`, json, {
      headers: {
        'Authorization': `Bearer ${this.access_token}`,
        'User-Agent': 'gologin-api',
      },

    });

    if (response.statusCode === 400) {
      throw new Error(`gologin failed account creation with status code, ${response.statusCode} DATA  ${JSON.stringify(response.body.message)}`);
    }

    if (response.statusCode === 500) {
      throw new Error(`gologin failed account creation with status code, ${response.statusCode}`);
    }
    debug(JSON.stringify(response.body));
    return response.body.id;
  }

  async delete(pid) {
    const profile_id = pid || this.profile_id;
    await requests.delete(`${API_URL}/browser/${profile_id}`, {
      headers: {
        'Authorization': `Bearer ${this.access_token}`,
        'User-Agent': 'gologin-api',
      },
    });
  }

  async update(options) {
    this.profile_id = options.id;
    const profile = await this.getProfile();

    if (options.navigator) {
      Object.keys(options.navigator).map((e) => { profile.navigator[e] = options.navigator[e] });
    }

    Object.keys(options).filter(e => e !== 'navigator').map((e) => { profile[e] = options[e] });

    debug('update profile', profile);
    const response = await requests.put(`https://api.gologin.com/browser/${options.id}`, {
      json: profile,
      headers: {
        'Authorization': `Bearer ${this.access_token}`
      }
    });
    debug('response', JSON.stringify(response.body));
    return response.body
  }

  setActive(is_active) {
    this.is_active = is_active;
  }

  getGeolocationParams(profileGeolocationParams, tzGeolocationParams) {
    if (profileGeolocationParams.fillBasedOnIp) {
      return {
        mode: profileGeolocationParams.mode,
        latitude: Number(tzGeolocationParams.latitude),
        longitude: Number(tzGeolocationParams.longitude),
        accuracy: Number(tzGeolocationParams.accuracy),
      };
    }
    return {
      mode: profileGeolocationParams.mode,
      latitude: profileGeolocationParams.latitude,
      longitude: profileGeolocationParams.longitude,
      accuracy: profileGeolocationParams.accuracy,
    }
  };

  getViewPort() {
    return { ...this.resolution };
  };

  async postCookies(profileId, cookies) {
    const formattedCookies = cookies.map(cookie => {
      if (!['no_restriction', 'lax', 'strict', 'unspecified'].includes(cookie.sameSite)) {
        cookie.sameSite = 'unspecified';
      }

      return cookie;
    });

    const response = await BrowserUserDataManager.uploadCookies({
      profileId,
      cookies: formattedCookies,
      API_BASE_URL: API_URL,
      ACCESS_TOKEN: this.access_token,
    });

    if (response.statusCode === 200) {
      return response.body;
    }

    return { status: 'failure', status_code: response.statusCode, body: response.body };
  }

  async getCookies(profileId) {
    const response = await BrowserUserDataManager.downloadCookies({
      profileId,
      API_BASE_URL: API_URL,
      ACCESS_TOKEN: this.access_token,
    });

    return response.body;
  }

  async writeCookiesToFile() {
    const cookies = await this.getCookies(this.profile_id);
    if (!cookies.length) {
      return;
    }

    const resultCookies = cookies.map((el) => ({ ...el, value: Buffer.from(el.value) }));

    let db;
    try {
      db = await CookiesManager.getDB(this.cookiesFilePath, false);
      const chunckInsertValues = CookiesManager.getChunckedInsertValues(resultCookies);

      for (const [query, queryParams] of chunckInsertValues) {
        const insertStmt = await db.prepare(query);
        await insertStmt.run(queryParams);
        await insertStmt.finalize();
      }
    } catch (error) {
      console.log(error.message);
    } finally {
      await db && db.close();
    }
  }

  async uploadProfileCookiesToServer() {
    const cookies = await CookiesManager.loadCookiesFromFile(this.cookiesFilePath);
    if (!cookies.length) {
      return;
    }

    return this.postCookies(this.profile_id, cookies);
  }

  async start() {
    if (this.is_remote) {
      return this.startRemote()
    }
    if (!this.executablePath) {
      await this.checkBrowser();
    }
    const ORBITA_BROWSER = this.executablePath || this.browserChecker.getOrbitaPath;
    console.log(">>>>>>>>>>>>>>>>>>>>>>>>>>> ORBITA_BROWSER: ", ORBITA_BROWSER);

    const orbitaBrowserExists = await access(ORBITA_BROWSER).then(() => true).catch(() => false);

    if (!orbitaBrowserExists) {
      throw new Error(`Orbita browser is not exists on path ${ORBITA_BROWSER}, check executablePath param`);
    }

    await this.createStartup(false);
    // await this.createBrowserExtension();
    const wsUrl = await this.spawnBrowser();
    this.setActive(true);
    return { status: 'success', wsUrl };
  }

  async startLocal() {
    await this.createStartup(true);
    // await this.createBrowserExtension();
    const wsUrl = await this.spawnBrowser();
    this.setActive(true);
    return { status: 'success', wsUrl };
  }


  async stop() {
    await new Promise(resolve => setTimeout(resolve, 500));
    if (this.is_remote) {
      return this.stopRemote();
    }

    await this.stopAndCommit({ posting: true }, false);
  }

  async stopLocal(options) {
    const opts = options || { posting: false };
    await this.stopAndCommit(opts, true);
  }

  async waitDebuggingUrl(delay_ms, try_count = 0) {
    await delay(delay_ms);
    const url = `https://${this.profile_id}.orbita.gologin.com/json/version`;
    console.log('try_count=', try_count, 'url=', url);
    const response = await requests.get(url)
    let wsUrl = '';
    console.log('response', response.body);

    if (!response.body) {
      return wsUrl;
    }

    try {
      const parsedBody = JSON.parse(response.body);
      wsUrl = parsedBody.webSocketDebuggerUrl;
    } catch (e) {
      if (try_count < 3) {
        return this.waitDebuggingUrl(delay_ms, try_count + 1);
      }
      return { 'status': 'failure', wsUrl, 'message': 'Check proxy settings', 'profile_id': this.profile_id }
    }

    wsUrl = wsUrl.replace('ws://', `wss://`).replace('127.0.0.1', `${this.profile_id}.orbita.gologin.com`)
    return wsUrl;
  }

  async startRemote(delay_ms = 10000) {
    debug(`startRemote ${this.profile_id}`);

    /*
    if (profileResponse.statusCode !== 202) {
      return {'status': 'failure', 'code':  profileResponse.statusCode};
    }
    */

    // if (profileResponse.body === 'ok') {
    const profile = await this.getProfile();

    const profileResponse = await requests.post(`https://api.gologin.com/browser/${this.profile_id}/web`, {
      headers: {
        'Authorization': `Bearer ${this.access_token}`
      }
    });

    debug('profileResponse', profileResponse.statusCode, profileResponse.body);

    if (profileResponse.statusCode === 401) {
      throw new Error("invalid token");
    }

    const { navigator = {}, fonts, os: profileOs } = profile;
    this.fontsMasking = fonts?.enableMasking;
    this.profileOs = profileOs;
    this.differentOs =
      profileOs !== 'android' && (
        OS_PLATFORM === 'win32' && profileOs !== 'win' ||
        OS_PLATFORM === 'darwin' && profileOs !== 'mac' ||
        OS_PLATFORM === 'linux' && profileOs !== 'lin'
      );

    const {
      resolution = '1920x1080',
      language = 'en-US,en;q=0.9',
    } = navigator;
    this.language = language;
    const [screenWidth, screenHeight] = resolution.split('x');
    this.resolution = {
      width: parseInt(screenWidth, 10),
      height: parseInt(screenHeight, 10),
    };

    let wsUrl = await this.waitDebuggingUrl(delay_ms);
    if (wsUrl != '') {
      return { 'status': 'success', wsUrl }
    }

    return { 'status': 'failure', 'message': profileResponse.body };
  }

  async stopRemote() {
    debug(`stopRemote ${this.profile_id}`);
    const profileResponse = await requests.delete(`https://api.gologin.com/browser/${this.profile_id}/web`, {
      headers: {
        'Authorization': `Bearer ${this.access_token}`
      }
    });
    console.log(`stopRemote ${profileResponse.body}`);
    if (profileResponse.body) {
      return JSON.parse(profileResponse.body);
    }
  }

  getAvailableFonts() {
    return fontsCollection
      .filter(elem => elem.fileNames)
      .map(elem => elem.name)
  }
}

module.exports = GoLogin;
