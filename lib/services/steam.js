"use strict";

var reporter = require('../helpers/reporter')();
var os = require('os');
var config;

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
		// MAYBE: Check if Home Streaming is enabled
		cb(null, true);
	},

	setup: function(_userDataReader, _userDataWriter, cb) {
		cb(null);
	},

	validateRequiredSoftware: function(cb) {
		// Warn OS X El Capitan
		
		if(os.platform() === "darwin" && os.release().indexOf("15") !== -1) {
			reporter.report("\n\n[!] El Capitan has an issue with port 27036 not binding again if you close and open Steam (Steam must be loaded from an initial boot) [!]\n", "warn")
		}

		cb(null, true);	
	},

	getState: function(cb) {
		cb(null);
	}

};