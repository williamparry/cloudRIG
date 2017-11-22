const UglifyJsPlugin = require('uglifyjs-webpack-plugin')

module.exports = {
    entry: "./.tmp/index.prod.js",
	output: {
		path: __dirname,
		filename: './.tmp/index.js'
	},
	node: {
		__dirname: false,
		__filename: false
	},
    target: "electron",
	plugins: [
		new UglifyJsPlugin()
	]
};