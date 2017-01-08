var reporter;
var id;

module.exports = {
	
	set: function(_reporter, _id) {
		reporter = _reporter;
		id = _id;
	},

	report: function(msg, level) {
		if(reporter) {
			reporter[level || "log"].apply(null, ["[" + id + "]"].concat(msg));
		}
	}

}