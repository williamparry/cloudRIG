// TODO: Merge into common lib

const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('path')
const url = require('url')
const async = require('async');
const cloudrig = require('cloudriglib')

let win

const log = (message) => {
	if(win) {
		win.webContents.send('log', message);
	}
}

cloudrig.init(log);

ipcMain.on('cmd', (event, op, data) => {
	
	switch(op) {

		case 'log':

			event.sender.send('log', data)

		break;

		case 'getCredentials':

			event.returnValue = cloudrig.getCredentials().toString()

		break;

		case 'saveCredentialsFile':

			cloudrig.saveCredentialsFile(data);
			event.returnValue = true;

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

		case 'setConfiguration':

			cloudrig.setConfig(cloudrig.getConfigFile())
			event.returnValue = true;

		break;

		case 'disableNonPlay':

			event.sender.send('disableNonPlay', data)

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

				event.sender.send('gotState', data)

			})

		break;

		case 'start':

			event.sender.send('starting', true)

			cloudrig.start(function(err) {

				event.sender.send('starting', false)

				if(err) {
					event.sender.send('errorPlay', err)
					return;
				}

				event.sender.send('started')
				
			})

		break;

		case 'stop':

			event.sender.send('stopping', true)

			cloudrig.stop(function(err) {

				event.sender.send('stopping', false)

				if(err) {
					event.sender.send('errorStop')
					return;
				}
				
				event.sender.send('stopped')

			})

		break;

	}

});

function createWindow() {

	win = new BrowserWindow({ width: 800, height: 600, resizable: false, show: false })

	win.loadURL(url.format({
		pathname: path.join(__dirname, 'build/index.html'),
		protocol: 'file:',
		slashes: true
	}))
	
	win.on('closed', () => {
		win = null
	})

	win.once('ready-to-show', () => {
		win.show()
	})

	win.webContents.on('new-window', function(e, url) {
		e.preventDefault();
		require('electron').shell.openExternal(url);
	});


}

app.on('ready', createWindow)

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit()
	}
})

app.on('activate', () => {
	
	if (win === null) {
		createWindow()
	}

})