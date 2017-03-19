"use strict";

var exec = require('child_process').exec;
var reporter = require('../helpers/reporter')();
var config;

var isWin = /^win/.test(process.platform);
var applescript = isWin ? null : require('applescript');
var plist = isWin ? null : require('simple-plist');
var homedir = require('os').homedir();

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

function create(cb) {

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
						'keystroke "localhost"',
						'keystroke "w" using {command down}',
						'delay 3',
						'keystroke "q" using {command down}',

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

module.exports = {

	id: "RDP",

	setConfig: function(_config) {
		config = _config;
	},

	setReporter: function(_reporter) {
		reporter.set(_reporter, "RDP");
	},

	getRequiredConfig: function() {
		return [];
	},

	validateRequiredConfig: validateRequiredConfig,

	validateRequiredSoftware: validateRequiredSoftware,

	setup: function(_userDataReader, _userDataWriter, cb) {

		// TODO: Handle bookmark outside of config file
		// TODO: Test fresh install for instance of file
		if(isWin) {
			cb("Windows not supported yet");
			return;
		}

		// Find reference to cloudrig
		

		plist.readFile(`${homedir}/Library/Containers/com.microsoft.rdc.mac/Data/Library/Preferences/com.microsoft.rdc.mac.plist`, (err, data) => {
			
			if (err) {
				cb(err);
				return;
			}

			var exists = false;
			Object.keys(data).forEach((key) => {
				
				if(data[key] == "cloudrig") {
					exists = true;
				}

			});

			var questions = [];

			if(!exists) {

				questions.push({
					q: "Shall I make a RDP bookmark called 'cloudrig' for you? (It will be filled in when you open it through the CLI)",
					m: create.bind(this)
				});

			}

			cb(null, questions);

		});
	},

	getState: function(cb) {

		validateRequiredSoftware(function(err, exists) {
			cb(null, {
				Exists: exists
			});
		});

	},

	_create: create,

	open: function(publicDNS, password, cb) {

		if(!isWin) {

			// https://social.technet.microsoft.com/Forums/windows/en-US/b84ed2fc-dd03-4d9f-91a2-ce183437fb49/launch-os-x-remote-desktop-8x-from-command-line?forum=winRDc

		var cmd = [
			'tell application "Microsoft Remote Desktop"',
				
				'activate',
					
					'tell application "System Events"',
						
						'set frontmost of process "Microsoft Remote Desktop" to true',
						
						'tell process "Microsoft Remote Desktop"',

							'keystroke "f" using {command down}',
							'delay 1',
							'key code 53',
							'delay 1',
							'keystroke "cloudrig"',
							'keystroke tab',
							'key code 125',
							'keystroke "e" using {command down}',
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

};