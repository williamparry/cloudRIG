var async = require('async');
var RDP = require('./src/rdp');
var VPN = require('./src/vpn');
var Steam = require('./src/steam');
var Instance = require('./src/instance');
var reporter = require('./src/reporter');

var config;
/*
if (require.main === module) {
   console.error("You can't run this on its own. Use the CLI or app");
   return;
}
*/

function getConfigState() {

	for(var k in config) {
		if(config[k] == "") {
			return false;
		}
	}

	return true;

}

module.exports = {

	setReporter: function(_reporter) {
		reporter.set(_reporter, "Instance");
		Instance.setReporter(_reporter);
	},

	setConfig: function(_config) {
		reporter.report("setConfig" + JSON.stringify(_config));
		config = _config;
		VPN.setConfig(config);
		Instance.setConfig(config);
	},

	getConfigState: function() {
		return getConfigState();
	},

	init: function(cb) {
		Instance.init(cb);
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

	getState: function(cb) {
		// TODO: Better error handling if things don't exist
		async.parallel([
			Instance.getState,
			VPN.getState,
			Steam.getState,
			RDP.getState
		], cb);
		
	},

	update: function(cb) {
		Instance.update(cb);
	},

	openRDP: function(cb) {

		Instance.getState(function(err, instanceState) {
			RDP.openRDP(instanceState.activeInstances[0].PublicDnsName, cb);
		});
		
	},

	// NOT IMPLEMENTED
	createRDP: function(cb) {

		RDP.createRDP("publicdns","password", cb);

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