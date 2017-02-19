var exec = require('child_process').exec;
var reporter = require('../helpers/reporter')();
var async = require('async');
var config;

function validateRequiredSoftware(cb) {
			
	exec('ls /Applications/ | grep -i "Steam.app"', function (error, stdout, stderr) {
		
		if (error) {
			cb(error);
			return;
		}

		cb(null, stdout !== "");
		
	});
	
}

// NOT IMPLEMENTED
function portOpen(cb) {

	exec('lsof -n -i -P | grep 27036', function (error, stdout, stderr) {
		
		if (error) {
			cb(error);
			return;
		}

		cb(null, stdout.indexOf('steam_osx') !== -1);

	});

}




module.exports = {

	id: "Steam",

	setConfig: function(_config) {
		config = _config;
	},

	setReporter: function(_reporter) {
		reporter.set(_reporter, "Steam");
	},

	getRequiredConfig: function() {
		return [];
	},

	validateRequiredConfig: function(cb) {
		cb(null, true);
	},

	setup: function(cb) {
		cb(null);
	},

	validateRequiredSoftware: validateRequiredSoftware,

	getState: function(cb) {
		
		async.parallel([
			validateRequiredSoftware,
			portOpen
		], function(error, results) {

			if(error) {
				cb(error);
				return;
			}

			cb(null, {
				Exists: results[0],
				PortOpen: results[1]
			});	
			
		});

	}

}