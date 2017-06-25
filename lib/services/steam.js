"use strict";

var reporter = require('../helpers/reporter')();
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
		cb(null, true);
	},

	setup: function(_userDataReader, _userDataWriter, cb) {
		cb(null);
	},

	validateRequiredSoftware: function(cb) {
		cb(null, true);	
	},

	getState: function(cb) {
		cb(null);
	}

};