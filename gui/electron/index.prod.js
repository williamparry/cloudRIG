const common = require('./common')
const path = require('path')

common.registerCMDHook("getCredentials", function(cloudrig, event, op, data, flags) {
	event.returnValue = cloudrig.getCredentials().toString()
}, true)

common.registerCMDHook("saveCredentialsFile", function(cloudrig, event, op, data, flags) {
	cloudrig.saveCredentialsFile(data);
	event.returnValue = true;
}, true)

// TODO: Remove
common.registerCMDHook("updateFail", function(event, op, data) {
	event.sender.send('updateCheck', false)
})

common.init({
	pathname: path.join(__dirname, 'build/index.html'),
	protocol: 'file:',
	slashes: true
})