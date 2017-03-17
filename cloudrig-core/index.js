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

// The point of this file is to create helper functions and pass through into the services
module.exports = {

	setReporter: function(_reporter) {
		reporter.set(_reporter, "Core");
		services.forEach((service) => service.setReporter(_reporter));
	},

	setConfig: function(_config) {
		config = _config;
		services.forEach((service) => service.setConfig(config));
	},

	getRequiredConfig: function() {
		var ret = {};
		services.forEach((service) => {
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
		async.parallel(services.map((service) => {
			return function(cb) {
				service.validateRequiredSoftware((err, state) => {
					ret[service.id] = state;
					cb()
				})
			}
		}), function() {
			cb(null, ret);
		})
	},

	getState: function(cb) {
		// TODO: Better error handling if things don't exist
		var ret = {};
		async.parallel(services.map((service) => {
			return function(cb) {
				service.getState((err, state) => {
					ret[service.id] = state;
					cb()
				})
			}
		}), function() {
			cb(null, ret);
		})
		
	},

	setup: function(_userDataReader, _userDataWriter, cb) {

		var ret = {};
		// BUG: Callback still firing on error
		async.parallel(services.map((service) => {
			return function(cb) {
				service.setup(_userDataReader, _userDataWriter, (err, state) => {
					if(err) {
						cb(err);
						return;
					}
					ret[service.id] = state;
					cb()
				})
			}
		}), function(err, results) {
			if(err) {
				cb(err);
				return;
			}
			cb(null, ret);
		})
	},

	sendMessage: Instance.sendMessage,

	start: function(cb) {
		
		reporter.report("Starting instance...");

		return Instance.start(() => {

			reporter.report("Starting VPN...");
			VPN.start(() => {
			
				// Get remote info
				Instance.sendMessage(VPN.getRemoteInfoCommand(), (err, resp) => {

					var address = JSON.parse(resp).address;

					// Send to VPN to add to network
					reporter.report("Adding Instance VPN address '" + address + "' to VPN...");
					VPN.addCloudrigAddressToVPN(address, () => {

						// Tell instance to join
						reporter.report("Join Instance to VPN...");
						Instance.sendMessage(VPN.getRemoteJoinCommand(), (err, resp) => {

							reporter.report("Joined");
							cb(null);

						});

					});

				});

			});

		});

	},

	stop: function(cb) {

		async.parallel([
			Instance.stop,
			VPN.stop
		], cb);

	},

	openRDP: function(cb) {
		Instance.getPassword((err, password) => {
			Instance.getState(function(err, instanceState) {
				RDP.open(instanceState.activeInstances[0].PublicDnsName, password, cb);
			});
		});
	},

	createVPN: function(cb) {
		VPN.create(cb)
	},

	snapshot: function(stop, del, cb) {
		
		// We need to find the existing snapshot here if we want to delete it
		Instance.findSnapshot((err, snapshot) => {
			
			Instance.snapshot(snapshot.SnapshotId, () => {
				
				reporter.report("Snapshot taken");

				if(stop) {

					reporter.report("Stopping...");

					async.parallel([
						Instance.stop,
						VPN.stop
					], () => {

						if(del) {

							reporter.report("Waiting 30s for the AMI to release the snapshot");

							setTimeout(() => {
								Instance.deleteSnapshot(snapshot.SnapshotId, cb);
							}, 30000);

						} else {
							cb(null);
						}

					});

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

}

// Set up security group
// Set up image id
// Se up key