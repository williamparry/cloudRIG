const common = require("./common");
const path = require('path');

const logger = require('electron-log');

logger.transports.console.level = 'silly'
logger.transports.console.format = '{h}:{i}:{s}.{ms} {processType} {level} - {text}';
logger.transports.file.level = 'debug'
logger.transports.console.format = '{h}:{i}:{s}.{ms} {processType} {level} - {text}';


// The profile names should match the ones in ~/.aws/credentials
let testCredentialsFile = `
[default]
aws_access_key_id=testaccesskeyid
aws_secret_access_key=testsercretaccesskey
[cloudrig]
aws_access_key_id=testaccesskeyid2
aws_secret_access_key=testsercretaccesskey2
`;

common.registerCMDHook("getCredentials", function (event, op, data) {
  event.returnValue = testCredentialsFile;
});

common.registerCMDHook("saveCredentialsFile", function (event, op, data) {
  testCredentialsFile = data;
  event.returnValue = true;
});

common.init(
  {
    pathname: path.join(__dirname, 'dev.html'),
    protocol: 'file:',
    slashes: true
  },
  function (win) {

  }
);
