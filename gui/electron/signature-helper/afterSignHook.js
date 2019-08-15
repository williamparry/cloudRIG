// See: https://medium.com/@TwitterArchiveEraser/notarize-electron-apps-7a5f988406db

const fs = require('fs');
const path = require('path');
var electron_notarize = require('electron-notarize');

module.exports = async function (params) {
	// Only notarize the app on Mac OS only.
	if (process.platform !== 'darwin') {
		return;
	}

	// Same appId in electron-builder.
	let appId = require('../package.json').build.appId;
	console.log('Using appId: ' + appId);

	let appPath = path.join(params.appOutDir, `${params.packager.appInfo.productFilename}.app`);
	if (!fs.existsSync(appPath)) {
		throw new Error(`Cannot find application at: ${appPath}`);
	}

	if (process.env.MACOS_NOTORIZATION_ENABLE === "false") {
		console.log("App notorization has been explicitely disabled (MACOS_NOTORIZATION_ENABLE)")
		return;
	}

	console.log(`Notarizing ${appId} found at ${appPath}...`);

	try {
		await electron_notarize.notarize({
			appBundleId: appId,
			appPath: appPath,
			appleId: process.env.MACOS_NOTORIZATION_APPLEID,
			appleIdPassword: process.env.MACOS_NOTORIZATION_APPLEID_PASSWORD,
		});
	} catch (error) {
		console.error(error);
	}

	console.log(`Done notarizing ${appId}`);
};
