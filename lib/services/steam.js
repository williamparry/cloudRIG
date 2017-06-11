/*
TODO:	Make cross-platform
*/

"use strict";

var exec = require('child_process').exec;
var reporter = require('../helpers/reporter')();
var async = require('async');
var config;

function validateRequiredSoftware(cb) {

	cb(null, true); // Until we have Windows sussed
	return;
	/*
	exec('ls /Applications/ | grep -i "Steam.app"', function (error, stdout, stderr) {
		
		if (error) {
			cb(error);
			return;
		}

		cb(null, stdout !== "");
		
	});
	*/
	
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

	setup: function(_userDataReader, _userDataWriter, cb) {
		cb(null);
	},

	validateRequiredSoftware: validateRequiredSoftware,

	getState: function(cb) {
		
		async.parallel([
			validateRequiredSoftware
		], function(error, results) {

			if(error) {
				cb(error);
				return;
			}

			cb(null, {
				Exists: results[0]
			});	
			
		});

	}

};