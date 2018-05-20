const { app, BrowserWindow, ipcMain, dialog } = require('electron')
require('electron-context-menu')();
const url = require('url')
const async = require('async');
const cloudrig = require('cloudriglib')
const autoUpdater = require("electron-updater").autoUpdater
const fs = require('fs');
const homedir = require('os').homedir();
const opn = require("opn");

autoUpdater.autoDownload = false

let hooks = {}
let urlObj = {}
let onCreateWindow;
let win

const log = (message) => {
	if (win) {
		win.webContents.send('log', message);
	}
}

function createWindow() {

	win = new BrowserWindow({ width: 800, height: 600, resizable: false, show: false })

	win.loadURL(url.format(urlObj))

	// Emitted when the window is closed.
	win.on('closed', () => {
		ipcMain.removeAllListeners('cmd')
		// Dereference the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		win = null
	})

	win.once('ready-to-show', () => {
		win.show()
	})

	win.webContents.on('new-window', function (e, url) {
		e.preventDefault();
		require('electron').shell.openExternal(url);
	});

	if (onCreateWindow) {
		onCreateWindow(win);
	}

}

function cmdHandler(event, op, data) {

	switch (op) {

		case 'log':

			event.sender.send('log', data)

			break;

		case 'checkForUpdates':

			autoUpdater.on('update-available', (info) => {
				event.sender.send('updateCheck', true)
			});

			autoUpdater.on('update-not-available', (info) => {
				event.sender.send('updateCheck', false)
			});

			autoUpdater.on('error', (err) => {
				cmdHandler(event, 'updateFail')
			})

			autoUpdater.checkForUpdates();

			break;

		case 'doUpdate':

			event.sender.send('updateDownloading')

			autoUpdater.on('download-progress', (info) => {
				event.sender.send('updateDownloadProgress', info)
			});

			autoUpdater.on('update-downloaded', (info) => {
				autoUpdater.quitAndInstall();
			});

			autoUpdater.downloadUpdate();

			break;

		case 'openVNC':

			cloudrig.getActiveInstances((err, activeInstances) => {
				if (err) {
					event.sender.send('error', err)
					return;
				}
				opn(`vnc://admin:4ubg9sde@${activeInstances[0].PublicDnsName}`);
			})

			break;

		case 'selectCredentialsFile':

			dialog.showOpenDialog(win, {
				title: "Select AWS Credentials file",
				defaultPath: "~/.aws",
				properties: [
					"openFile",
					"promptToCreate",
					"showHiddenFiles"
				],
				message: "Select AWS Credentials file; this will be loaded into the cloudRIG app"
			}, function (filePaths) {
				event.sender.send('credentialsFileChosen', filePaths)
			})

			break;

		case 'getConfiguration':

			event.returnValue = cloudrig.getConfigFile()

			break;

		case 'getConfigurationValidity':

			cloudrig.validateRequiredConfig(cloudrig.getConfigFile(), function (err) {
				event.sender.send('getConfigurationValidity', !err)
			})

			break;

		case 'saveInitialConfiguration':
			cloudrig.setConfigFile(data);
			cloudrig.setConfig(data)
			event.sender.send('savedInitialConfiguration', data)
			break;

		case 'saveConfiguration':

			cloudrig.validateRequiredConfig(data, function (err) {
				if (err) {
					event.sender.send('error', err)
					return;
				}
				cloudrig.setConfigFile(data);
				event.sender.send('getConfigurationValidity', true)
			});

			break;

		case 'setConfiguration':

			cloudrig.setConfig(cloudrig.getConfigFile())
			event.returnValue = true;

			break;

		case 'disableNonPlay':

			event.sender.send('disableNonPlay', data)

			break;

		case 'setup':

			cloudrig.setup(function (err, setups) {
				if (err) {
					event.sender.send('error', err)
					return;
				}
				if (setups.length > 0) {

					event.sender.send('setups', setups);
					return;
				}

				event.sender.send('setupValid', true)

			});

			break;

		case 'runSetupSteps':

			cloudrig.setup(function (err, setups) {

				var toProcess = setups.map(step => {
					return step.m
				});

				// TODO: Bit loose, tidy up later
				async.parallel(toProcess, function (err, val) {

					if (err) {
						event.sender.send('error', err)
						return;
					}

					event.sender.send('setupCheck')

				});

			});

			break;

		case 'getState':

			cloudrig.getState(function (err, data) {

				if (err) {
					event.sender.send('errorPlay', err)
					return;
				}

				event.sender.send('gotState', data)

			})

			break;

		case 'start':

			event.sender.send('starting', true)

			cloudrig.start(function (err) {

				event.sender.send('starting', false)

				if (err) {
					event.sender.send('errorPlay', err)
					return;
				}

			})

			break;

		case 'stop':

			event.sender.send('stopping', true)

			cloudrig.stop(function (err) {

				event.sender.send('stopping', false)

				if (err) {
					event.sender.send('errorStop')
					return;
				}

			})

			break;

		case 'scheduleStop':

			event.sender.send('possessiveStarted')
			cloudrig.scheduleStop(function (err) {
				if (err) { event.sender.send('error', err); return; }
				event.sender.send('possessiveFinished')
			});

			break;

		case 'unScheduleStop':

			event.sender.send('possessiveStarted')
			cloudrig.cancelScheduledStop(function (err) {
				if (err) { event.sender.send('error', err); return; }
				event.sender.send('possessiveFinished')
			});

			break;

		case 'addStorage':

			event.sender.send('possessiveStarted')
			cloudrig.createEBSVolume(data.availabilityZone, data.size, function (err) {
				if (err) { event.sender.send('error', err); return; }
				event.sender.send('possessiveFinished')
			});

			break;

		case 'deleteStorage':
			event.sender.send('possessiveStarted')
			cloudrig.deleteEBSVolume(data, function (err) {
				if (err) { event.sender.send('error', err); return; }
				event.sender.send('possessiveFinished')
			});

			break;

		case 'transferStorage':

			event.sender.send('possessiveStarted')
			cloudrig.transferEBSVolume(data, function (err) {
				if (err) { event.sender.send('error', err); return; }
				event.sender.send('possessiveFinished')
			});

			break;

		case 'expandStorage':
			event.sender.send('possessiveStarted')
			cloudrig.expandEBSVolume(data.VolumeId, data.newVolumeSize, function (err) {
				if (err) { event.sender.send('error', err); return; }
				event.sender.send('possessiveFinished')
			});

			break;

		case 'changePage':

			event.sender.send('changePage', data)

			break;

		case 'error':

			dialog.showMessageBox(win, {
				type: "error",
				message: JSON.stringify(data, null, 4)
			})

			break;

		case 'closeWithError':

			dialog.showMessageBox(win, {
				type: "error",
				message: JSON.stringify(data, null, 4)
			})

			win.close();

			break;

		case 'prepareUpdate':

			cloudrig.validateRequiredConfig(cloudrig.getConfigFile(), function (err) {

				if (err) { event.sender.send('error', err); return; }

				// Config is valid
				if (!err) {

					cloudrig.setup(function (err, setups) {

						if (err) { event.sender.send('error', err); return; }

						cloudrig.prepareUpdate(function (err, resp) {
							if (err) { event.sender.send('error', err); return; }

							if (resp.code === 1) {
								event.sender.send('updateReady')
							} else if (resp.code === 2) {
								event.sender.send('updateNotReady', resp.message)
							}

						})

					});

				}

			})

			break;

	}

	if (hooks[op]) {
		hooks[op](event, op, data)
	}
}

function init(_urlObj, _onCreateWindow) {

	urlObj = _urlObj;
	onCreateWindow = _onCreateWindow

	cloudrig.init(log);

	ipcMain.on('cmd', cmdHandler);

	app.on('ready', createWindow)

	// Quit when all windows are closed.
	app.on('window-all-closed', () => {
		// On macOS it is common for applications and their menu bar
		// to stay active until the user quits explicitly with Cmd + Q
		if (process.platform !== 'darwin') {
			app.quit()
		}
	})

	app.on('activate', () => {
		// On macOS it's common to re-create a window in the app when the
		// dock icon is clicked and there are no other windows open.
		if (win === null) {
			createWindow()
		}
	})

}

function registerCMDHook(cmd, method, withLib) {
	hooks[cmd] = withLib ? method.bind(null, cloudrig) : method;
}

module.exports.registerCMDHook = registerCMDHook;

module.exports.init = init;
