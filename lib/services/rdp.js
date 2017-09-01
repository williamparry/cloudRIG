"use strict";

var config;
var client;
var reporter = require('../helpers/reporter')();
var open = require("open");
var forever = require('forever-monitor');

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

	validateRequiredConfig: function (configValues, cb) {
		cb(null, true);
	},

	validateRequiredSoftware: function(cb) {
		cb(null, true);
	},

	setup: function(_userDataReader, _userDataWriter, cb) {
		cb(null);
	},

	getState: function(cb) {
		cb(null);
	},

	open: function(publicDNS, password, cb) {

		if(!client) {

			client = new (forever.Monitor)(__dirname + '/mstsc/app.js', {
				max: 1,
				silent: true,
				args: ["--publicDNS=" + publicDNS, "--password=" + password]
			});

			client.on('stdout', function (data) {

				if(data.toString().trim() === "[STARTED]") {
					open("http://localhost:8080");
					cb(null);
				}

			});

			client.on('error', function () {
				cb("Error making RP client");
			});

			client.on('exit', function () {
				client = null;
			});

			client.start();

		} else {
			open("http://localhost:8080");
			cb(null);
		}

	}

};