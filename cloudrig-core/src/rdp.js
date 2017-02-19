var exec = require('child_process').exec;
var reporter = require('./reporter')();
var config;

var isWin = /^win/.test(process.platform);
var applescript = isWin ? null : require('applescript')

function getRequiredConfig() {
	return ["RDPConnectionName"]
}

function validateRequiredConfig(configValues, cb) {

	// TODO: Test that bookmark exists
	cb(null, true);

}

function validateRequiredSoftware(cb) {

	exec('ls /Applications/ | grep -i "Microsoft Remote Desktop.app"', function (error, stdout, stderr) {
		
		if (error) {
			cb(error);
			return;
		}

		cb(null, stdout !== "");

	});

}

module.exports = {

	id: "RDP",

	setConfig: function(_config) {
		config = _config;
	},

	setReporter: function(_reporter) {
		reporter.set(_reporter, "RDP");
	},

	getRequiredConfig: function() {
		return getRequiredConfig();
	},

	validateRequiredConfig: validateRequiredConfig,

	validateRequiredSoftware: validateRequiredSoftware,

	setup: function(cb) {
		cb(null);
	},

	getState: function(cb) {

		validateRequiredSoftware(function(err, exists) {
			cb(null, {
				Exists: exists
			})
		})

	},

	create: function(publicDNS, password, cb) {

		if(!isWin) {

			// https://social.technet.microsoft.com/Forums/windows/en-US/b84ed2fc-dd03-4d9f-91a2-ce183437fb49/launch-os-x-remote-desktop-8x-from-command-line?forum=winRDc

		var cmd = [
			'tell application "Microsoft Remote Desktop"',
				
				'activate',
					
					'tell application "System Events"',
						
						'set frontmost of process "Microsoft Remote Desktop" to true',
						
						'tell process "Microsoft Remote Desktop"',

							'keystroke "n" using {command down}',
							'keystroke "cloudrig"',
							'keystroke tab',
							'delay 1',
							'keystroke "' + publicDNS + '"',
							'keystroke tab',
							'keystroke tab',
							'delay 1',
							'keystroke "administrator"',
							'keystroke tab',
							'delay 1',
							'keystroke "' + password + '"',
							'keystroke "w" using {command down}',

					'end tell',
					
				'end tell',

			'end tell'].join("\n");

			applescript.execString(cmd, function(err, rtn) {
				if (err) {
					cb("Applescript error " + err);
				} else {
					cb();
				}

			});

		}


	},

	open: function(publicDNS, cb) {

		if(!isWin) {

			// https://social.technet.microsoft.com/Forums/windows/en-US/b84ed2fc-dd03-4d9f-91a2-ce183437fb49/launch-os-x-remote-desktop-8x-from-command-line?forum=winRDc

		var cmd = [
			'tell application "Microsoft Remote Desktop"',
				
				'activate',
					
					'tell application "System Events"',
						
						'set frontmost of process "Microsoft Remote Desktop" to true',
						
						'tell process "Microsoft Remote Desktop"',

							'keystroke "f" using {command down}',
							'keystroke "cloudrig"',
							'keystroke tab',
							'key code 125',
							'keystroke "e" using {command down}',
							'keystroke tab',
							'delay 1',
							'keystroke "' + publicDNS + '"',
							'delay 1',
							'keystroke "w" using {command down}',
							'key code 36',

					'end tell',
					
				'end tell',

			'end tell'].join("\n");

			applescript.execString(cmd, function(err, rtn) {
				if (err) {
					cb("Applescript error " + err);
				} else {
					cb();
				}

			});

		}


	}

}