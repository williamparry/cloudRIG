var exec = require('child_process').exec;
var reporter = require('./reporter');

var isWin = /^win/.test(process.platform);
var applescript;
if(!isWin) {
	applescript = require('applescript');
}

module.exports = {

	setReporter: function(_reporter) {
		reporter.set(_reporter, "RDP");
	},

	getState: function(cb) {

		exec('ls /Applications/ | grep -i "Microsoft Remote Desktop.app"', function (error, stdout, stderr) {
			
			if (error) {
				cb(error);
				return;
			}

			cb(null, {
				Exists:	stdout !== ""
				// TODO: Check bookmark is present
			});

		});

	},

	createRDP: function(publicDNS, password, cb) {

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

	openRDP: function(publicDNS, cb) {

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