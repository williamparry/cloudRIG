"use strict";

var exec = require('child_process').exec;
var commandExists = require('command-exists');
var async = require('async');
var publicIp = require('public-ip');
var request = require('request');
var reporter = require('../helpers/reporter')();
var config;
var vpnName = "cloudrig";
var settings = {};

function getRequiredConfig() {
	return ["ZeroTierAPIKey"];
}

function validateRequiredSoftware(cb) {

	commandExists('zerotier-cli', function(err, commandExists) {

		if(err) {

			cb("VPN check error", err);
			return;

		}

		cb(null, commandExists);

	});

}

function joined(cb) {

	var child = exec('zerotier-cli listnetworks -j');

	child.stdout.on('data', function(data) {
		cb(null, JSON.parse(data).length > 0);
	});

	child.stderr.on('data', function(data) {
		cb("VPN state error: " + data);
	});

}

function makeOptions() {
	return {
		url: 'https://my.zerotier.com/api/',
		headers: {
			'Authorization': 'Bearer ' + config.ZeroTierAPIKey
			
		}
	};
}

function addUserToVPN(vpnId, address, cb) {

	reporter.report("Adding user '" + address + "' to '" + vpnId + "'");

	var newVPNOptions = makeOptions();
	newVPNOptions.url += "network/" + vpnId + "/member/" + address;
	newVPNOptions.method = "POST";
	newVPNOptions.json = {
		"hidden": false,
		"config": {
			"authorized": true 
		}
	};

	request(newVPNOptions, function (error, response, body) {
	
		if(error) {
			cb(error);
			return;
		}

		if (response.statusCode == 200) {
			cb(null);
		}

	});
	
	
}

function create(cb) {

	async.waterfall([

		function(cb) {

			reporter.report("Making VPN network");

			var options = makeOptions();
			options.url += "network";
			options.method = "POST";
			options.json = {

				"config": {

					"name": vpnName,

					"rules": [
						{
							"ruleNo": 20,
							"etherType": 2048,
							"action": "accept"
						},
						{
							"ruleNo": 21,
							"etherType": 2054,
							"action": "accept"
						},
						{
							"ruleNo": 30,
							"etherType": 34525,
							"action": "accept"
						}
					],
					"private": true,
					"enableBroadcast": true,
					"multicastLimit": 32,
					"v4AssignMode": "zt",
					"routes":[
						{
							"target": "10.147.17.0/24",
							"via": null,
							"flags": 0,
							"metric": 0
						}
					],
					"ipAssignmentPools": [
						{
							"ipRangeStart": "10.147.17.1",
							"ipRangeEnd": "10.147.17.254"
						}
					],

					"ui": {
						"v4EasyMode": true
					}
				}
				
			};
			
			request(options, function (error, response, body) {
				
				if(error) {
					cb(error);
					return;
				}

				if (response.statusCode == 200) {
					cb(null, body);
				}

			});

		},
		function(newVPN, cb) {

			reporter.report("Adding user");

			var child = exec('zerotier-cli info -j');

			child.stdout.on('data', function(data) {

				data = JSON.parse(data);
				
				addUserToVPN(newVPN.id, data.address, cb);

			});

			child.stderr.on('data', function(data) {
				cb("VPN info error: " + data);
			});

		}

	], function(err, id) {

		cb(null, id);

	});

}

function getId(cb) {

	var id;

	var existsOptions = makeOptions();
		existsOptions.url += "network/";
		existsOptions.method = "GET";
		
	request(existsOptions, function (error, response, data) {

		if(error) {
			cb(error);
			return;
		}

		data = JSON.parse(data);

		data.forEach((network) => {

			if(network.config.name.toLowerCase() == vpnName) {
				id = network.id;
				return;
			}

		});

		cb(null, id);

	});

}

function getRemoteInfoCommand() {
	return ['& "${env:ProgramFiles(x86)}\\ZeroTier\\One\\zerotier-cli.bat" info -j'];
}

function getRemoteJoinCommand() {
	return ['& "${env:ProgramFiles(x86)}\\ZeroTier\\One\\zerotier-cli.bat" join ' + settings.id];
}

function addCloudrigAddressToVPN(cloudrigAddress, cb) {
	addUserToVPN(settings.id, cloudrigAddress, cb);
}

module.exports = {
	
	id: "VPN",

	settings: {},

	setConfig: function(_config) {
		config = _config;
	},

	validateRequiredConfig: function(cb) {
		// TODO: Make call with auth token
		cb(null, true);
	},

	setup: function(_userDataReader, _userDataWriter, cb) {
		
		var questions = [];

		getId(function(err, id) {

			if(!id) {

				questions.push({
					q: "Can I make a CloudRig ZeroTier network for you called " + vpnName + "?",
					m: create.bind(this)
				});

				return;

			} else {

				settings.id = id;

			}

		});

		cb(null, questions, settings);
	},

	setReporter: function(_reporter) {
		reporter.set(_reporter, "VPN");
	},

	getRequiredConfig: function() {
		return getRequiredConfig();
	},

	getRemoteInfoCommand: getRemoteInfoCommand,

	getRemoteJoinCommand: getRemoteJoinCommand,

	validateRequiredSoftware: validateRequiredSoftware,

	addCloudrigAddressToVPN: addCloudrigAddressToVPN,

	getState: function(cb) {
		
		async.parallel([
			validateRequiredSoftware,
			joined
		], function(error, results) {

			if(error) {
				cb(error);
				return;
			}

			cb(null, {
				Exists: results[0],
				Joined: results[1]	
			});	
			
		});

	},

	// also restart
	start: function(cb) {

		var child = exec('zerotier-cli join ' + settings.id);

		child.stdout.on('data', function(data) {
			cb(null);
		});

		child.stderr.on('data', function(data) {
			cb("VPN start error: " + data);
		});

	},

	stop: function(cb) {

		var child = exec('zerotier-cli leave ' + settings.id);

		child.stdout.on('data', function(data) {
			cb();
		});

		child.stderr.on('data', function(data) {
			cb("VPN stop error: " + data);
		});

	},

	create: function (cb) {

		create(cb);

	}

};