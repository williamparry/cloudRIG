var async = require('async');
var RDP = require('./src/rdp');
var VPN = require('./src/vpn');
var Steam = require('./src/steam');
var Instance = require('./src/instance');
var reporter = require('./src/reporter')();

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

	setup: function(cb) {
		var ret = {};
		async.parallel(services.map((service) => {
			return function(cb) {
				service.setup((err, state) => {
					ret[service.id] = state;
					cb()
				})
			}
		}), function() {
			cb(null, ret);
		})
	},

	start: function(cb) {
		return Instance.start(function() {
			VPN.start(cb);
		});
	},

	stop: function(cb) {

		async.parallel([
			Instance.stop,
			VPN.stop
		], cb);

	},

	update: function(cb) {
		Instance.update(cb);
	},

	openRDP: function(cb) {

		Instance.getState(function(err, instanceState) {
			RDP.open(instanceState.activeInstances[0].PublicDnsName, cb);
		});
		
	},

	// NOT IMPLEMENTED
	createRDP: function(cb) {

		RDP.create("publicdns","password", cb);

	},

	createVPN: function(cb) {

		VPN.create(cb)

	},

	updateAndTerminate: function(cb) {
		
		Instance.update(function() {
			
			reporter.report("Updated");

			async.parallel([
				Instance.stop,
				VPN.stop
			], cb);

		});

	},

	_instance: Instance,

	_VPN: VPN,

	_RDP: RDP,

	_Steam: Steam

}

// Set up security group
// Set up image id
// Se up key