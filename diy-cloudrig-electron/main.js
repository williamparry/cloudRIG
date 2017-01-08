const electron = require('electron')
const fs = require('fs');
const app = electron.app
const BrowserWindow = electron.BrowserWindow
const ipc = electron.ipcMain
const path = require('path')
const url = require('url')
const moment = require('moment')
const cloudrig = require('diy-cloudrig-core');

let loaded = false;

let mainWindow

const configPath = "./config.json";

function getConfigFromFile() {

	if(fs.existsSync(configPath)) {
	
		return JSON.parse(fs.readFileSync(configPath));
		
	} else {

		var config;

		// TODO: Do this from a sample, maybe from core (getConfigSchema() or somesuch)
		config = {
			"AWSCredentialsProfile": "cloudrig",
			"AWSKeyPairName": "",
			"AWSMaxPrice": "0.6",
			"AWSRegion": "",
			"RDPConnectionName": "",
			"ZeroTierNetworkId": ""
		}

		setConfigFile(config);

		return config;

	}

}

function setConfigFile(config) {
	fs.writeFileSync("./config.json", JSON.stringify(config));
}

function createWindow() {

	mainWindow = new BrowserWindow({ width: 800, height: 600 })

	mainWindow.loadURL(url.format({
		pathname: path.join(__dirname, 'index.html'),
		protocol: 'file:',
		slashes: true
	}))

	mainWindow.webContents.openDevTools()

	mainWindow.on('closed', () => {
		mainWindow = null
	})

}


// UI requests state information
// UI initiates everything


ipc.on('get-config-state', (event, arg) => {
	console.log('get-config-state', cloudrig.getConfigState());
	event.sender.send('get-config-state-reply', cloudrig.getConfigState());
})

ipc.on('get-config', (event, arg) => {
	event.sender.send('get-config-reply', getConfigFromFile());
})

ipc.on('set-config', (event, arg) => {
	setConfigFile(arg);
	cloudrig.setConfig(arg);
	mainWindow.webContents.send("set-config-reply");
})

ipc.on('get-state', (event, arg) => {
	cloudrig.getState((err, results) => {
		event.sender.send('get-state-reply', results);
	});
})

ipc.on('init', (event, arg) => {
	cloudrig.init((err, settings) => {
		event.sender.send('init-reply', settings);
	})
})

ipc.on('start', (event, arg) => {
	cloudrig.start((err, results) => {
		event.sender.send('start-reply', results);
	});
})

ipc.on('stop', (event, arg) => {
	cloudrig.stop((err, results) => {
		event.sender.send('stop-reply', results);
	});
})

ipc.on('update', (event, arg) => {
	cloudrig.update((err, results) => {
		event.sender.send('update-reply', results);
	});
})

ipc.on('update-stop', (event, arg) => {
	cloudrig.updateAndTerminate((err, results) => {
		event.sender.send('update-stop-reply', results);
	});
})

ipc.on('open-rdp', (event, arg) => {
	cloudrig.openRDP((err) => {
		event.sender.send('open-rdp-reply');
	});
})

ipc.on('get-logs', (event, arg) => {
	
	fs.readFile("logs.txt", (e, logs) => {
		event.sender.send('get-logs-reply', logs);
	});

});

app.on('ready', () => {
	
	var config = getConfigFromFile();
	
	cloudrig.setReporter((() => {
		
		function send(msg, level) {

			msg = "[" + moment().format() + "][" + level + "]" + msg + "\n";

			fs.appendFile("logs.txt", msg);
			
			if(mainWindow) {
				mainWindow.webContents.send("reporter-report", {
					msg: msg,
					level: level
				});
			}
		}

		return {

			log: function() {
				
				var args = Array.prototype.slice.apply(arguments);
				send(args.join(" "), "log");
				console.log.apply(null, arguments);
				
			},

			error: function() {

				var args = Array.prototype.slice.apply(arguments);
				send(args.join(" "), "error");
				console.error.apply(null, arguments);
				
			}	
			
		};	
		
	})());

	cloudrig.setConfig(config);

	createWindow();	
})

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit()
	}
})

app.on('activate', () => {
	if (mainWindow === null) {
		createWindow()
	}
})

// Add ping
// Add AWS pricing