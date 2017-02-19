var fs = require('fs');
var async = require('async');
var cloudrig = require('../cloudrig-core');
var inquirer = require('inquirer');
var prettyjson = require('prettyjson');
var figlet = require('figlet');
var cowsay = require('cowsay');

function getConfigFile() {
	return JSON.parse(fs.readFileSync("./config.json"));
}

function setConfigFile(config) {
	fs.writeFileSync("./config.json", JSON.stringify(config));
}



function displayState(cb) {

	console.log("\nState:");

	cloudrig.getState(function(err, state) {
		
		var display = {

			"Instances": {
				"Active": state.AWS.activeInstances.length > 0 ? state.AWS.activeInstances.map(function(f) { return f.PublicDnsName }) : 0,
				"Pending": state.AWS.pendingInstances.length,
				"Shutting down": state.AWS.shuttingDownInstances.length
			},
			"ZeroTier": state.VPN,
			"Steam": state.Steam,
			"Microsoft Remote Desktop exists": state.RDP
		}
				
		console.log("\n" + prettyjson.render(display, null, 4));

		cb();

	});

}

function mainMenu() {

	var choices = ["Get State", "Advanced"];

	cloudrig.getState(function(err, state) {
		
		if(state.AWS.activeInstances.length > 0) {
			choices = choices.concat(["Stop CloudRig", "Open RDP", "Update AMI", "Update AMI and shut down"]);
		} else {
			choices = choices.concat(["Start CloudRig", "Setup"]);
		}

		console.log("");

		inquirer.prompt([{
			name: "cmd",
			message: "bb u want 2?\n",
			type: "rawlist",
			choices: choices
		}

		]).then((answers) => {

			switch(answers.cmd) {

				case "Advanced":

					advancedMenu(mainMenu);

				break;

				case "Start CloudRig":

					var start = cloudrig.start(function() {

						console.log("K done");
						mainMenu();

					});

					console.log(prettyjson.render(start, null, 4));

				break;

				case "Stop CloudRig":

					cloudrig.stop(function() {
						
						console.log("\nTERMINATED");
						mainMenu();

					});

				break;

				case "Setup":

					configMenu(() => {
						setup(mainMenu);
					});

				break;

				case "Open RDP":
					
					cloudrig.openRDP(function() {

						console.log("Opening...");
						mainMenu();

					});

				break;

				case "Get State":

					displayState(mainMenu);

				break;

				case "Update AMI":

					cloudrig.update(function() {
						
						console.log("Updated");
						mainMenu();

					});

				break;

				case "Update AMI and shut down":

					cloudrig.updateAndTerminate(function() {

						console.log("\nUpdated and TERMINATED");
						mainMenu();

					});

				break;

			}
			
		});

	});

}

function configMenu(cb) {

	var config = getConfigFile();
	var questions = [];

	Object.keys(config).forEach((configKey) => {

		questions.push({
			type: "input",
			name: configKey,
			message: configKey,
			default: config[configKey]
		});
	
	});

	inquirer.prompt(questions).then((answers) => {

		if(Object.keys(answers).filter((v) => { return !v }).length > 0) {
			console.log("You have an empty value. Gotta have all dem values mate");
			setupMenu(cb);
		} else {

			Object.assign(config, answers);
			setConfigFile(config);

			cb()

		}
	
	})

}

function advancedMenu(cb) {

	inquirer.prompt([{
		name: "cmd",
		message: "Advanced\n",
		type: "rawlist",
		choices: ["Back", "VPN Start", "Get Remote VPN Address"]
	}

	]).then((answers) => {

		switch(answers.cmd) {

			case "Back":
				cb();
			break;

			case "VPN Start":

				cloudrig._VPN.start(function() {
					cb();
				})

			break;

			case "Get Remote VPN Address":

				cloudrig._instance.sendMessage(cloudrig._VPN.getRemoteInfoCommand(), (err, resp) => {
					console.log(resp);
				});

			break;

		}

	});

}

function validateRequiredSoftware(cb) {

	console.log("\nValidating required software...");

	cloudrig.validateRequiredSoftware((err, software) => {
		
		if(err) {
			cb(err);
			return;
		}

		var errors = [];
		
		Object.keys(software).forEach((key) => {
			if(!software[key]) {
				errors.push(key + " is missing");
			}
		});

		if(errors.length > 0) {
			console.log(prettyjson.render(errors, null, 4));
			cb(true);
		} else {
			cb(null);
		}

	});

}

/* TODO:
function validateRequiredConfig(cb) {

	console.log("\nValidating required config...");

	cloudrig.validateRequiredConfig((err, serviceConfig) => {
		
		if(err) {
			cb(err);
			return;
		}

		var errors = [];
		
		Object.keys(software).forEach((key) => {
			if(!software[key]) {
				errors.push(key + " is missing");
			}
		});

		if(errors.length > 0) {
			console.log(prettyjson.render(errors, null, 4));
			cb(true);
		} else {
			cb(null);
		}

	});

}
*/

function validateAndSetConfig(cb) {
	
	console.log("\nValidating and setting config...")

	var config = getConfigFile();
	var configState = cloudrig.getRequiredConfig();
	var questions = [];

	Object.keys(configState).forEach((serviceName) => {

		configState[serviceName].forEach((serviceConfigKey) => {

			if(!config[serviceConfigKey]) {
				questions.push({
					type: "input",
					name: serviceConfigKey,
					message: "Enter " + serviceConfigKey
				})
			}
		})

	});
	
	if(questions.length > 0) {
		
		console.log("\nYou're missing some values in your config. Enter them below:\n")

		inquirer.prompt(questions).then((answers) => {

			// TODO: cloudrig.validateRequiredConfig()

			Object.assign(config, answers);
			setConfigFile(config);
			validateAndSetConfig(cb);

		});

	} else {

		console.log("\nSetting config:\n");
		console.log(prettyjson.render(config, null, 4));
		cloudrig.setConfig(config);

		cb(null);

	}

}

function setup(cb) {

	console.log("\nSetting up...");

	cloudrig.setup(function(err, serviceSetups) {
		
		if(err) {
			cb(err);
			return;
		}

		var questions = [];

		Object.keys(serviceSetups).forEach((serviceSetup) => {

			var serviceSetupQuestions = serviceSetups[serviceSetup];

			if(serviceSetupQuestions) {

				serviceSetupQuestions.forEach((question) => {

					questions.push({
						text: "[" + serviceSetup + "] " + question.q,
						func: question.m
					});

				});

			}

		});

		if(questions.length > 0) {

			console.log("\nThere's some things that need to be set up. I can do it for you.\n")

			inquirer.prompt(questions.map((question, i) => {

				return {
					type: "confirm",
					name: "q-" + i,
					message: question.text
				}

			})).then((answers) => {
				
				var toProcess = [];
				
				Object.keys(answers).forEach((answer, i) => {

					if(answers[answer]) {
						toProcess.push(questions[i].func)
					}

				})

				if(toProcess.length > 0) {

					console.log("\n");

					async.parallel(toProcess, function(err, val) {

						console.log("\nOK done. Redoing setup to check it's all good...");
						setup(cb);

					})

				}

			})

		} else {

			cb(null)

		}
			
	});

}

function setReporter() {
	cloudrig.setReporter(console);
}

function showIntro() {

	console.log(figlet.textSync('CloudRig', {
		font: 'Standard',
		horizontalLayout: 'default',
		verticalLayout: 'default'
	}));

	console.log(cowsay.say({
		text : "u know toilet duck\nor whatever\ni got some on my lip today\ncleaning the toilt\nit burned like fuck\ndon't recommend",
		e : "oO",
		T : "U "
	}));

}

function checkAndSetDefaultConfig() {
	// TODO: Make this safer for already existing config file
	// fs.existsSync
	try {
		getConfigFile();
	} catch(ex) {
		console.log("\n[!] Config file missing/broken - copying from config.sample.json")
		setConfigFile(JSON.parse(fs.readFileSync("./config.sample.json")));
	}
}

// INIT

showIntro();
checkAndSetDefaultConfig();
setReporter();

async.series([

	validateRequiredSoftware,
	validateAndSetConfig,
	setup

], (err) => {

	if(err) {
		console.log(cowsay.say({
			text : "Something catastrophic went wrong.",
			e : "oO",
			T : "U "
		}));
		return;
	}

	mainMenu();

});