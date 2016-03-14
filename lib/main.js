'use strict';

const electron = require('electron');
// Module to control application life.
const app = electron.app;
const ipc = require('ipc');
// Module to create native browser window.
const BrowserWindow = electron.BrowserWindow;

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

function createWindow () {
  // Create the browser window.
  mainWindow = new BrowserWindow({width: 1366, height: 790});

  // and load the index.html of the app.
  mainWindow.loadURL('file://' + __dirname + '/index.html');
  mainWindow.setFullScreen(true);

  // Open the DevTools.
  //mainWindow.webContents.openDevTools();

  // Emitted when the window is closed.
  mainWindow.on('closed', function() {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
app.on('ready', createWindow);

// Quit when all windows are closed.
app.on('window-all-closed', function () {
  // On OS X it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', function () {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0';

const https = require('https');

const SERVER_PORT = 5000;
const UPDATE_INTERVAL = 1000;
const DEFAULT_RETURN_ON = ['login', 'logout', 'play', 'pause', 'error', 'ap'];
const DEFAULT_HTTPS_CONFIG = {
  host: '',
  port: 4370,
  path: '',
  headers: {'Origin': 'https://open.spotify.com'}
};

let config;
let version;
let csrf;
let oauth;
let albumId;
let coverUrl;

function copyConfig() {
  return JSON.parse(JSON.stringify(DEFAULT_HTTPS_CONFIG));
}

function generateLocalHostname() {
  /*return randomstring.generate({
    length: 10,
    charset: 'abcdefghijklmnopqrstuvwxyz'
  }) + '.spotilocal.com';*/
  return '127.0.0.1';
}

function getUrl(path) {
  generateLocalHostname() + '/' + path;
}

function getJson(config, callback) {
  https.get(config, function(res) {
    var body = '';
    res.on('data', function (d) {
      body += d;
    });
    res.on('end', function () {
      callback(JSON.parse(body));
    });
  });
}

function getStatus() {
  config = copyConfig();
  config.host = generateLocalHostname();
  config.path = '/remote/status.json?oauth=' + oauth + '&csrf=' + csrf + '&returnafter=1&returnon=' + DEFAULT_RETURN_ON.join();
  getJson(config, function(data) { console.log(data); });
}

function getCurrentAlbumId() {
  config = copyConfig();
  config.host = generateLocalHostname();
  config.path = '/remote/status.json?oauth=' + oauth + '&csrf=' + csrf + '&returnafter=1&returnon=' + DEFAULT_RETURN_ON.join();
  getJson(config, function(data) {
    try {
      if (data.track.album_resource.uri.split(':')[2] !== albumId) {
        console.log('ALBUM UPDATED');
        albumId = data.track.album_resource.uri.split(':')[2];
        console.log(albumId);
        getAlbumCover(albumId);
      }
    }
    catch(ex) {
      console.log(ex);
    }
  });
}

function getAlbumCover(id) {
  config = copyConfig();
  config.host = 'api.spotify.com';
  config.path = '/v1/albums/' + id;
  config.port = 443;
  getJson(config, function(data) {
    console.log(data.images[0].url);
    coverUrl = data.images[0].url;
    if (mainWindow !== null) {
      mainWindow.webContents.send('coverUrl', coverUrl);
    }
  });
}

config = copyConfig();
config.host = generateLocalHostname();
config.path = '/service/version.json?service=remote';
getJson(config, function(data) { version = data; });
config.host = generateLocalHostname();
config.path = '/simplecsrf/token.json';
getJson(config, function(data) { csrf = data.token; });
config.host = 'open.spotify.com';
config.path = '/token';
config.port = 443;
getJson(config, function(data) { oauth = data.t; });
let updateTrackCover;
let waitForRequest = setInterval(function() {
  if (typeof version !== 'undefined' && typeof csrf !== 'undefined' && typeof oauth !== 'undefined') {
    clearInterval(waitForRequest);
    console.log('done.');
    console.log(version);
    console.log(csrf);
    console.log(oauth);
    updateTrackCover = setInterval(getCurrentAlbumId, UPDATE_INTERVAL);
  }
  else {
    console.log('waiting...');
  }
}, 500);