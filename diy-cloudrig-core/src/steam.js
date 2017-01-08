var exec = require('child_process').exec;
var async = require('async');

function exists(cb) {
			
	exec('ls /Applications/ | grep -i "Steam.app"', function (error, stdout, stderr) {
		
		if (error) {
			cb(error);
			return;
		}

		cb(null, stdout !== "");
		
	});
	
}

function running(cb) {

	exec('ps aux | grep steam_osx', function (error, stdout, stderr) {
		
		if (error) {
			cb(error);
			return;
		}

		cb(null, stdout.indexOf('MacOS/steam_osx') !== -1);

	});

}

module.exports = {

	getState: function(cb) {
		
		async.parallel([
			exists,
			running
		], function(error, results) {

			if(error) {
				cb(error);
				return;
			}

			cb(null, {
				Exists: results[0],
				Running: results[1]	
			});	
			
		});

	}

}