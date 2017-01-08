var exec = require('child_process').exec;
var commandExists = require('command-exists');
var async = require('async');
var config;

function exists(cb) {

	commandExists('zerotier-cli', function(err, commandExists) {

		if(err) {

			cb("VPN check error", err || "zerotier-cli does not exist");
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

module.exports = {

	setConfig: function(_config) {
		config = _config;
	},

	getState: function(cb) {
		
		async.parallel([
			exists,
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

		var child = exec('zerotier-cli join ' + config.ZeroTierNetworkId);

		child.stdout.on('data', function(data) {
			cb();
		});

		child.stderr.on('data', function(data) {
			cb("VPN start error: " + data);
		});

	},

	stop: function(cb) {

		var child = exec('zerotier-cli leave ' + config.ZeroTierNetworkId);

		child.stdout.on('data', function(data) {
			cb();
		});

		child.stderr.on('data', function(data) {
			cb("VPN stop error: " + data);
		});

	}

}