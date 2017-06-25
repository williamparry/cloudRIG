/*
TODO:	Make cross-platform
TODO:	Move PowerShell helper from instance.js to its own helper file
*/

"use strict";

var exec = require('child_process').exec;
var commandExists = require('command-exists');
var async = require('async');
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

				"ui": {
					"membersHelpCollapsed": true,
					"rulesHelpCollapsed": true,
					"settingsHelpCollapsed": true,
					"v4EasyMode": true
				},

				"config": {
					"enableBroadcast": true,
					"ipAssignmentPools": [
						{
							"ipRangeStart": "10.147.17.1",
							"ipRangeEnd": "10.147.17.254"
						}
					],
					"mtu": 2800,
					"multicastLimit": 32,
					"name": vpnName,
					"private": true,
					"routes": [{
						"target": "10.147.17.0/24",
						"via": null
					}],
					"rules": [{
						"etherType": 2048,
						"not": true,
						"or": false,
						"type": "MATCH_ETHERTYPE"
					}, {
						"etherType": 2054,
						"not": true,
						"or": false,
						"type": "MATCH_ETHERTYPE"
					}, {
						"etherType": 34525,
						"not": true,
						"or": false,
						"type": "MATCH_ETHERTYPE"
					}, {
						"type": "ACTION_DROP"
					}, {
						"type": "ACTION_ACCEPT"
					}],
					"v4AssignMode": {
						"zt": true
					},
					"v6AssignMode": {
						"6plane": false,
						"rfc4193": false,
						"zt": false
					}

				},

				"rulesSource": "#\n# This is a default rule set that allows IPv4 and IPv6 traffic but otherwise\n# behaves like a standard Ethernet switch.\n#\n# Please keep in mind that ZeroTier versions prior to 1.2.0 do NOT support advanced\n# network rules.\n#\n# Since both senders and receivers enforce rules, you will get the following\n# behavior in a network with both old and new versions:\n#\n# (old: 1.1.14 and older, new: 1.2.0 and newer)\n#\n# old <--> old: No rules are honored.\n# old <--> new: Rules work but are only enforced by new side. Tags will NOT work, and\n#               capabilities will only work if assigned to the new side.\n# new <--> new: Full rules engine support including tags and capabilities.\n#\n# We recommend upgrading all your devices to 1.2.0 as soon as convenient. Version\n# 1.2.0 also includes a significantly improved software update mechanism that is\n# turned on by default on Mac and Windows. (Linux and mobile are typically kept up\n# to date using package/app management.)\n#\n\n#\n# Allow only IPv4, IPv4 ARP, and IPv6 Ethernet frames.\n#\ndrop\n\tnot ethertype ipv4\n\tand not ethertype arp\n\tand not ethertype ipv6\n;\n\n#\n# Uncomment to drop non-ZeroTier issued and managed IP addresses.\n#\n# This prevents IP spoofing but also blocks manual IP management at the OS level and\n# bridging unless special rules to exempt certain hosts or traffic are added before\n# this rule.\n#\n#drop\n#\tnot chr ipauth\n#;\n\n# Accept anything else. This is required since default is 'drop'.\naccept;\n",
				
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

		data.forEach(function(network) {

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
					q: "Can I make a cloudRIG ZeroTier network for you called " + vpnName + "?",
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