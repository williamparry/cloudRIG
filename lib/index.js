"use strict";

var async = require('async');
var RDP = require('./services/rdp');
var VPN = require('./services/vpn');
var Steam = require('./services/steam');
var Instance = require('./services/instance');
var reporter = require('./helpers/reporter')();

var services = [Steam, Instance, RDP, VPN];

var config;

/*
if (require.main === module) {
   console.error("You can't run this on its own. Use the CLI or app");
   return;
}
*/

function openRDP(cb) {
	Instance.getPassword(function(err, password) {
		Instance.getState(function(err, instanceState) {
			RDP.open(instanceState.activeInstances[0].PublicDnsName, password, cb);
		});
	});
}

// The point of this file is to create helper functions and pass through into the services
module.exports = {

	setReporter: function(_reporter) {
		reporter.set(_reporter, "Core");
		services.forEach(function(service) { service.setReporter(_reporter); });
	},

	setConfig: function(_config) {
		config = _config;
		services.forEach(function(service) { service.setConfig(config); } );
	},

	getRequiredConfig: function() {
		var ret = {};
		services.forEach(function (service) {
			ret[service.id] = service.getRequiredConfig();
		});
		return ret;
	},

	validateRequiredConfig: function(servicesRequiredConfig, cb) {

		// TODO
		cb(null, true);
/*
		Object.keys(servicesRequiredConfig, (serviceRequiredConfig) => {


			
		});

		var ret = {};
		services.forEach((service) => {
			ret[service.id] = service.getRequiredConfig();
		});
		return ret;
		*/
	},

	validateRequiredSoftware: function(cb) {
		var ret = {};
		async.parallel(services.map(function(service) {
			return function(cb) {
				service.validateRequiredSoftware(function(err, state) {
					ret[service.id] = state;
					cb();
				});
			};
		}), function() {
			cb(null, ret);
		});
	},

	getState: function(cb) {
		// TODO: Better error handling if things don't exist
		var ret = {};
		async.parallel(services.map(function(service) {
			return function(cb) {
				service.getState(function(err, state) {
					ret[service.id] = state;
					cb();
				});
			};
		}), function() {
			cb(null, ret);
		});
		
	},

	setup: function(_userDataReader, _userDataWriter, cb) {

		var ret = {};
		// BUG: Callback still firing on error
		async.parallel(services.map(function(service) {
			return function(cb) {
				service.setup(_userDataReader, _userDataWriter, function(err, state) {
					if(err) {
						cb(err);
						return;
					}
					ret[service.id] = state;
					cb(null);
				});
			};
		}), function(err, results) {
			if(err) {
				cb(err);
				return;
			}
			cb(null, ret);
		});
	},

	createSteamShortcut: Instance.createSteamShortcut,

	sendMessage: Instance.sendMessage,

	start: function(cb) {
		
		reporter.report("Starting instance");

		Instance.start(function(err, fromBase) {

			// TODO: If from base, prompt for steam creds or handle with menus

			if(err) {
				cb(err);
				return;
			}

			reporter.report("Starting VPN");

			VPN.start(function() {
				
				// TODO: Add detection for if already in VPN

				// Get remote info

				if(fromBase) {

					Instance.sendMessage(VPN.getRemoteInfoCommand(), function(err, resp) {

						var address = JSON.parse(resp).address;

						// Send to VPN to add to network
						reporter.report("Adding Instance VPN address '" + address + "' to VPN");
						VPN.addCloudrigAddressToVPN(address, function() {

							// Tell instance to join
							reporter.report("Join Instance to VPN");
							Instance.sendMessage(VPN.getRemoteJoinCommand(), function(err, resp) {

								reporter.report("Joined");

								openRDP(cb);
								
							});

						});

					});

				} else {
					Instance._restartSteam(cb);
				}
				
			});

		});

	},

	stop: function(cb) {

		async.parallel([
			Instance.stop,
			VPN.stop
		], cb);

	},

	openRDP: openRDP,

	createVPN: function(cb) {
		VPN.create(cb);
	},

	update: function(stop, del, cb) {
		
		Instance.getAMI(function(err, ami) {

			reporter.report("Updating");

			Instance.updateAMI(function() {
				
				if(stop) {
					async.parallel([
						Instance.stop,
						VPN.stop
					], cb);
				} else {
 
					
					if(del) {
						//Instance.deleteAMI(instanceId, cb);
					} else {
						cb(null);
					}
					
				}

			});

		});

	},

	_maintenance: function(cb) {
		Instance._maintenance(cb);
	},
	
	_Instance: Instance,

	_VPN: VPN,

	_RDP: RDP,

	_Steam: Steam

};