const electron = require('electron')
const ipc = electron.ipcRenderer;

let $tabs = $('.tabular.menu .item');
let $awsRegion = $('#AWSRegion');

let $configurationLabel = $("#configuration-label");
let $configForm = $('#config-form');
let $configSuccess = $('#config-success');

let $stateLabel = $("#state-label");
let $stateZeroTier = $("#state-zerotier");
let $installZeroTier = $("#install-zerotier");

let $stateMSFT = $("#state-msft");
let $installMSFT = $("#install-msft");

let $stateSteam = $("#state-steam");
let $installSteam = $("#install-steam");
let $openSteam = $("#open-steam");

let $stateConfiguration = $("#state-configuration");

let $stateMaxPrice = $("#state-maxprice");

let $instanceState = $(".instance-state");
let $stateInstanceInactive = $("#state-instance-inactive");
let $stateInstanceActive = $("#state-instance-active");
let $stateOutput = $("#state-output");
let stateOutputTextarea = $stateOutput.find("textarea")[0];

let $startCloudrig = $("#start-cloudrig");
let $stopCloudRig = $("#stop-cloudrig");
let $updateCloudrig = $("#update-cloudrig");
let $updateStopCloudrig = $("#update-stop-cloudrig");
let $openRDP = $("#open-rdp");

let $settingsArn = $("#settings-Arn");
let $settingsImageId = $("#settings-ImageId");
let $settingsSecurityGroupId = $("#settings-SecurityGroupId");

let getStatePoll;
let lastState;

function setConfigForm(config) {

	let configValidation = (() => {

		let o = Object.assign(config);

		Object.keys(o).forEach((key) => {
			o[key] = "empty"
		});

		return o;
		
	})();

	$configForm.form({
		
		fields: configValidation

	}).on("submit", (e) => {

		e.preventDefault();
		
		if($configForm.form('is valid')) {
			
			var newConfig = $configForm.form('get values');
			
			ipc.send('set-config', newConfig);

		}

	});

}

function setConfigFormData(config) {

	$stateMaxPrice.text(config.AWSMaxPrice);

	Object.keys(config).forEach((key) => {
		$("#" + key).val(config[key]);
	});

}

function setSettings(settings) {
	$settingsArn.text(settings.Arn);
	$settingsImageId.text(settings.ImageId);
	$settingsSecurityGroupId.text(settings.SecurityGroupId);
}

function setState(state) {

	if(JSON.stringify(state) == JSON.stringify(lastState)) {
		return;
	}

	lastState = state;

	var instance = state[0];
	var zerotier = state[1];
	var steam = state[2];
	var rdp = state[3];

	if(zerotier.Exists) {
		
		$stateZeroTier.text("Exists, " + (zerotier.joined ? "Joined" : "Not joined"));
		$installZeroTier.hide();

	} else {

		$stateZeroTier.text("Does not exist");
		$installZeroTier.show();

	}

	if(steam.Exists) {

		$stateSteam.text("Exists, " + (steam.Running ? "Running" : "Not running"));
		$installSteam.hide();

		if(!steam.Running) {
			$openSteam.show();
		} else {
			$openSteam.hide();
		}

	} else {
		$stateSteam.text("Does not exist");
		$installSteam.show();
	}
	
	if(rdp.Exists) {
		$stateMSFT.text("Exists");
		$installMSFT.hide();
	} else {
		$stateMSFT.text("Does not exist");
		$installMSFT.show();
	}

	if(!rdp.Exists || !steam.Exists || !steam.Running || !rdp.Exists) {
		
		$stateLabel.text("NOT OK");
		$("button[data-tab=home]").attr("disabled", "disabled").addClass("disabled");
		$tabs.tab("change tab", "software");

	} else {
		
		$stateLabel.text("");
		$("button[data-tab=home]").removeAttr("disabled").removeClass("disabled");
		$tabs.tab("change tab", "home");

	}

	$instanceState.removeClass("active");
	if(instance.activeInstances.length > 0) {
		$stateInstanceActive.addClass("active");
	}

	if(instance.pendingInstances.length > 0 || instance.shuttingDownInstances.length > 0) {
		$stateOutput.addClass("active");
	}

	if(instance.activeInstances.length == 0) {
		$stateInstanceInactive.addClass("active");
	}

	//$stateMaxPrice.text(state.maxPrice);

}

// init for Instance requires configuration to be set
// this means we have to have a valid configuration before we move on

function checkForInit(configOK) {
	
	console.log('checkForInit', configOK);
	
	if(configOK) {
		
		send("init");

		$stateLabel.show();
		$configurationLabel.text("");

		// Fuck you semantic-ui
		// $tabs.tab("disable tab", "home");
		$("button[data-tab=software]").removeAttr("disabled").removeClass("disabled");
		$tabs.tab("change tab", "software");

	} else {
		
		$stateLabel.hide();
		$configurationLabel.text("NOT OK");
		
		$("button[data-tab=software]").attr("disabled", "disabled").addClass("disabled");
		$tabs.tab("change tab", "configuration");
	}

}

function send(message, payload) {
	console.log(">>> " + message, payload || "");
	ipc.send(message, payload);
}

function log(msg) {
	stateOutputTextarea.innerHTML += msg;
	// BUG: Does not scroll bottom onload
	// Likely because parent element is hidden during startup
	stateOutputTextarea.scrollTop = stateOutputTextarea.scrollHeight;
}

ipc.on("get-config-reply", function(event, config) {

	console.log("<<< get-config-reply", config);

	setConfigForm(Object.assign({}, config));
	setConfigFormData(Object.assign({}, config));

});

ipc.on("get-config-state-reply", function(event, configOK) {
	console.log("<<< get-config-state-reply");
	checkForInit(configOK);	
});

ipc.on("set-config-reply", function() {

	console.log("<<< set-config-reply");

	$configSuccess.fadeIn();
	
	setTimeout(() => {
		$configSuccess.fadeOut();
	}, 5000);
	
	ipc.send('get-config');
	ipc.send('get-config-state');

});

ipc.on("init-reply", function(event, settings) {

	console.log("<<< init-reply", settings);

	setSettings(settings);

	getStatePoll = setInterval(function() {
		send("get-state");
	}, 5000);
	send("get-state");

});

ipc.on("get-state-reply", function(event, state) {

	console.log("<<< get-state-reply", state);
	setState(state);

});

ipc.on("get-logs-reply", function(event, logs) {
	console.log("<<< get-logs-reply", logs);
	log(logs);
});

ipc.on("reporter-report", function(event, data) {
	log(data.msg);
});

ipc.on("start-reply", function(event) {
	$stateOutput.addClass("active");
});

$stopCloudRig.on("click", function() {
	ipc.send("stop");
});

$updateCloudrig.on("click", function() {
	ipc.send("update");
});

$updateStopCloudrig.on("click", function() {
	ipc.send("update-stop");
});

$startCloudrig.on("click", function() {
	ipc.send("start");
});

$openRDP.on("click", function() {
	ipc.send("open-rdp");
});


// init

$tabs.tab();
$awsRegion.dropdown();

send('get-config');
send('get-config-state');
send('get-logs');