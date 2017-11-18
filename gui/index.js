const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const url = require('url')
const async = require('async');
const cloudrig = require('cloudriglib')

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let win

const log = (message) => {
	if(win) {
		win.webContents.send('log', message);
	}
}

cloudrig.init(log);

/*
ipcMain.on('asynchronous-message', (event, arg) => {
  console.log(arg)  // prints "ping"
  event.sender.send('asynchronous-reply', 'pong')
})
*/
/*
ipcMain.on('setup', (event, arg) => {
  cloudrig.setup(function(err, serviceSetups) {
    event.returnValue = serviceSetups
  });
})
*/
ipcMain.on('cmd', (event, op, data) => {
	
	switch(op) {

		case 'log':

			event.sender.send('log', data)

		break;

		case 'getCredentials':

			event.returnValue = cloudrig.getCredentials().toString()

		break;

		case 'getConfiguration':

			event.returnValue = cloudrig.getConfigFile()

		break;

		case 'getConfigurationValidity':

			cloudrig.validateRequiredConfig(cloudrig.getConfigFile(), function(err) {
				event.sender.send('getConfigurationValidity', !err)
			})

		break;

		case 'saveConfiguration':

			cloudrig.validateRequiredConfig(data, function(err) {
				if(err) {
					event.sender.send('cmd', 'errorConfig')
					return;
				}
				cloudrig.setConfigFile(data);
				event.sender.send('getConfigurationValidity', true)
			});
			

		break;

		case 'saveCredentialsFile':

			cloudrig.saveCredentialsFile(data);
			event.returnValue = true;

		break;

		case 'setConfiguration':

			cloudrig.setConfig(cloudrig.getConfigFile())
			event.returnValue = true;

		break;

		case 'setup':
		
			cloudrig.setup(function (err, setups) {
				if(err) {
					event.sender.send('cmd', 'errorSetup')
					return;
				}
				if(setups.length > 0) {

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
				async.parallel(toProcess, function(err, val) {

					if(err) {
						event.sender.send('cmd', 'errorSetup')
						return;
					}

					event.sender.send('setupCheck')

				});

			});

		break;

		case 'getState':

			cloudrig.getState(function(err, data) {

				if(err) {
					event.sender.send('errorPlay', err)
					return;
				}

				if(data.activeInstances.length > 0) {
					event.sender.send('startRunning', true)
				}

				event.sender.send('gotState', data)
			})

		break;

		case 'start':

			event.sender.send('startRunning', true)

			cloudrig.start(function(err) {

				event.sender.send('startRunning', false)

				if(err) {
					event.sender.send('errorPlay', err)
					return;
				}

				event.sender.send('started')
				
			})

		break;

		case 'stop':

			cloudrig.stop(function(err) {
				if(err) {
					event.sender.send('errorStop')
					return;
				}
				event.sender.send('stopped')
				event.sender.send('startRunning', false)
			})

		break;

	}

});



function createWindow() {
	// Create the browser window.
	win = new BrowserWindow({ width: 800, height: 600, resizable: false, show: false })

	// and load the index.html of the app.
	win.loadURL(url.format({
		pathname: path.join(__dirname, 'build/index.html'),
		protocol: 'file:',
		slashes: true
	}))

	// Open the DevTools.
	//win.webContents.openDevTools()
	
	// Emitted when the window is closed.
	win.on('closed', () => {
		// Dereference the window object, usually you would store windows
		// in an array if your app supports multi windows, this is the time
		// when you should delete the corresponding element.
		win = null
	})

	win.once('ready-to-show', () => {
		win.show()
	})


}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
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

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.