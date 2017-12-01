const common = require('./common')

// The profile names should match the ones in ~/.aws/credentials
let testCredentialsFile = `
[default]
aws_access_key_id=testaccesskeyid
aws_secret_access_key=testaccesskeyid
[cloudrig]
aws_access_key_id=testaccessk2eyid3
aws_secret_access_key=testacces2skeyid3
`

common.registerCMDHook("getCredentials", function(event, op, data) {
	event.returnValue = testCredentialsFile;
})

common.registerCMDHook("saveCredentialsFile", function(event, op, data) {
	testCredentialsFile = data;
	event.returnValue = true;
})

common.registerCMDHook("updateFail", function(event, op, data) {
	event.sender.send('updateCheck', false)
})

common.init({
	pathname: 'localhost:3000',
	protocol: 'http:',
	slashes: true
}, function(win, autoUpdater) {
	autoUpdater.logger = null
	win.webContents.openDevTools()
})