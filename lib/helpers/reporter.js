"use strict";

module.exports = function() {

	var reporter;
	var id;

	return {

		set: function(_reporter, _id) {
			reporter = _reporter;
			id = _id;
		},

		report: function() {
			if(reporter) {
				var message = "[" + id + "] " + Array.prototype.slice.call(arguments).join("\t");
				console.log.call(null, message);
			}
		}

	};

};