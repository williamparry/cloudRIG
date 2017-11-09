"use strict";

var fs = require('fs');
var async = require('async');
var inquirer = require('inquirer');
var prettyjson = require('prettyjson');
var figlet = require('figlet');
var cowsay = require('cowsay');
var argv = require('yargs').argv;
var open = require("open");
var cloudrig = require('./lib');
var homedir = require('os').homedir();
var cloudrigDir = homedir + "/.cloudrig/";
var AWSCredsDir = homedir + "/.aws";
var AWSCredsFile = AWSCredsDir + "/credentials";	

if (!fs.existsSync(cloudrigDir)) {
	fs.mkdirSync(cloudrigDir);
}

function criticalError(err) {
	console.log(cowsay.say({
		text : 'Something went wrong:',
		e : "oO",
		T : "U "
	}));
	console.log(prettyjson.render(err, null, 4));
}

function getConfigFile() {
	return JSON.parse(userDataFileReader("config.json"));
}

function setConfigFile(config) {
	userDataFileWriter("config.json", JSON.stringify(config));
}

function userDataFileWriter(filename, content) {
	fs.writeFileSync(cloudrigDir + filename, content);
}

function userDataFileReader(filename) {
	return fs.readFileSync(cloudrigDir + filename);
}

function displayState(cb) {

	console.log("State:");

	cloudrig.getState(function(err, state) {
		console.log(state)
		var display = {

			"Instances": {
				"Active": state.activeInstances.length > 0 ? state.activeInstances.map(function(f) { return f.PublicDnsName; }) : 0,
				"Pending": state.pendingInstances.length,
				"Shutting down": state.shuttingDownInstances.length,
				"Stopped": state.stoppedInstances.length
			}
		};
				
		console.log(prettyjson.render(display, null, 4));

		cb();

	});

}

function mainMenu() {

	cloudrig.getState(function(err, state) {
		
		var choices;

		if(state.activeInstances.length > 0) {
			choices = ["Stop cloudRIG"];
		} else {
			choices = ["Start cloudRIG", "Setup"];
		}

		choices.push("Get State", "Advanced");

		inquirer.prompt([{
			name: "cmd",
			message: "Command:",
			type: "rawlist",
			choices: choices
		}

		]).then(function(answers) {

			switch(answers.cmd) {

				case "Start cloudRIG":

					cloudrig.start(function(err) {

						if(err) {
							criticalError(err);
							mainMenu();
							return;
						}
						console.log("K done");
						mainMenu();

					});

				break;

				case "Stop cloudRIG":

					cloudrig.stop(function() {
						
						console.log("Stopped");
						setup(mainMenu);

					});

				break;

				case "Setup":

					configMenu(function() {
						validateAndSetConfig(setup.bind(null, mainMenu));
					});

				break;

				case "Get State":

					displayState(mainMenu);

				break;

				case "Advanced":

					advancedMenu(function() {
						setup(mainMenu);
					});

				break;

			}
			
		});

	});

}

function configMenu(cb) {

	var config = getConfigFile();
	var questions = [];

	Object.keys(config).forEach(function(configKey) {

		questions.push({
			type: "input",
			name: configKey,
			message: configKey,
			default: config[configKey]
		});
	
	});

	inquirer.prompt(questions).then(function(answers) {

		Object.assign(config, answers);
		setConfigFile(config);

		cb();
			
	});

}

function advancedMenu(cb) {

	cloudrig.getState(function(err, state) {

		var choices = ["« Back"];

		if(state.activeInstances.length > 0) {
			choices.push(
				"Send Command"
			);
		}

		choices.push(
			"Clean up Instance Profiles"
		);

		inquirer.prompt([{
			name: "cmd",
			message: "Advanced",
			type: "rawlist",
			choices: choices
		}

		]).then(function(answers) {

			switch(answers.cmd) {
				
				case "« Back":
					cb();
				break;

				case "Send Command":

					console.log("Sending Ad Hoc");

					inquirer.prompt([{
						name: "sendCMD",
						message: "Command (empty will run .adhoc.ps1)",
						type: "input"
					}]).then(function(answers) {
						
						cloudrig._sendAdHoc(function(err, d) {

							console.log("Response");
							console.log(d);
							
							advancedMenu(cb);

						}, answers.sendCMD);
					
					});
					
				break;

				case "Clean up Instance Profiles":
					
					cloudrig._getInstanceProfiles(function(err, data) {
						
						if(data.length > 0) {

							inquirer.prompt([{
								name: "toDelete",
								message: "Select instance profiles to delete",
								type: "checkbox",
								choices: data.map(function(profile) {
									return {
										name: profile.InstanceProfileName
									};
								})

							}]).then(function(answers) {

								async.parallel(answers.toDelete.map(function(answer) {
									return cloudrig._deleteInstanceProfile.bind(null, answer);
								}), function(err, results) {
									console.log("Done");
									advancedMenu(cb);
								});

							});

						} else {

							console.log("No instance profiles");
							advancedMenu(cb);

						}

					});
				break;

				case "Create Security Group":
					cloudrig._createSecurityGroup(advancedMenu.bind(null, cb));
				break;
				
			}

		});

	});

}

function validateAndSetConfig(cb) {
	
	console.log("Getting config");

	var config = getConfigFile();
	var configState = cloudrig.getRequiredConfig();
	var questions = [];


	configState.forEach(function(configKey) {

		if(!config[configKey]) {
			questions.push({
				type: "input",
				name: configKey,
				message: "Enter " + configKey
			});
		}
	});
	
	if(questions.length > 0) {
		
		console.log("You're missing some values in your config. Enter them below:");

		inquirer.prompt(questions).then(function(answers) {

			Object.assign(config, answers);
			setConfigFile(config);
			validateAndSetConfig(cb);

		});

	} else {

		console.log("Validating config");

		cloudrig.validateRequiredConfig(config, function(err) {

			if(err) {

				console.log("Invalid AWS credentials. Please check your configuration");
				configMenu(validateAndSetConfig.bind(null, cb));

			} else {

				console.log("Setting config");
				var displayConfig = Object.assign({}, config);
				displayConfig.ParsecServerId = "(set)";
				
				console.log(prettyjson.render(displayConfig, null, 4));
				cloudrig.setConfig(config);
		
				cb();

			}

		});
		
	}

}

function setup(cb) {

	console.log("Setting up");

	cloudrig.setup(userDataFileReader, userDataFileWriter, function(err, serviceSetups) {
		
		if(err) { cb(err); return; }

		var questions = [];

		if(serviceSetups) {

			serviceSetups.forEach(function(question) {

				questions.push({
					text: question.q,
					func: question.m
				});

			});

		}

		if(questions.length > 0) {

			console.log("There's some things that need to be set up. I can do them for you.");

			inquirer.prompt(questions.map(function(question, i) {

				return {
					type: "confirm",
					name: "q-" + i,
					message: question.text
				};

			})).then(function(answers) {
				
				var toProcess = [];
				
				Object.keys(answers).forEach(function(answer, i) {

					if(answers[answer]) {
						toProcess.push(questions[i].func);
					}

				});

				if(toProcess.length > 0) {

					async.parallel(toProcess, function(err, val) {

						if(err) {
							cb(err);
							return;
						}

						console.log("OK done. Redoing setup to check it's all good");
						setup(cb);

					});

				}

			});

		} else {
			cb();

		}
			
	});

}

function setReporter() {
	cloudrig.setReporter(console);
}

function showIntro() {

	console.log(figlet.textSync('cloudRIG', {
		font: 'Standard',
		horizontalLayout: 'default',
		verticalLayout: 'default'
	}));
	
	console.log(cowsay.say({
		text : "This version of Parsec/cloudRIG/Spotfleet is unstable (but cool), so \nplease check your AWS console to ensure start/stop etc has worked.",
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
		console.log("[!] Config file missing/broken - copying from config.sample.json");
		setConfigFile(JSON.parse(fs.readFileSync(process.cwd() + "/lib/config.sample.json")));
	}
}

function startCloudrig() {
	
	async.series([
		
		validateAndSetConfig,
		setup

	], function(err) {

		if(err) {
			criticalError(err);
			return;
		}

		mainMenu();

	});

}

function init() {

	async.series([

		function(cb) {

			var credsExist = fs.existsSync(AWSCredsFile);

			function done(err) {
				if(err) {
					cb(err);
					return;
				}
				
				console.log("Done. Wait for 10s for it to propagate.");
				setTimeout(start, 10000);
				
			}

			if(!credsExist) {

				inquirer.prompt([{
					type: "confirm",
					name: "openconsole",
					message: "I can't find your AWS credentials file in ~/.aws/credentials. Open AWS console?",
					default: true
				}]).then(function(answers) {
					if(answers.openconsole) {
						open("https://console.aws.amazon.com/");
					} else {
						console.log("OK, when you've set it try again.");
					}
				});

			} else if(fs.readFileSync(AWSCredsFile).toString().indexOf("[cloudrig]") === -1) {

				console.log("\n");
				console.log("[!] BACK UP YOUR EXISTING CREDENTIALS FILE FIRST [!]");
				console.log("[!] BACK UP YOUR EXISTING CREDENTIALS FILE FIRST [!]");
				console.log("[!] BACK UP YOUR EXISTING CREDENTIALS FILE FIRST [!]");
				console.log("\n");

				inquirer.prompt([{
					type: "confirm",
					name: "openconsole",
					message: "Looks like your have a credentials file but no 'cloudrig' profile. Open AWS console?",
					default: true
				}]).then(function(answers) {
					if(answers.openconsole) {
						open("https://console.aws.amazon.com/");
					} else {
						console.log("OK, when cloudrig configuration starts, you can use another profile such as 'default'");
						cb();
					}
				});

			} else {
				cb();
			}
		},

		function(cb) {

			var parsecServerId = getConfigFile().ParsecServerId;
			
			if(!parsecServerId) {

				inquirer.prompt([{
					type: "confirm",
					name: "hasparsec",
					message: "Do you have a Parsec account and server key?",
					default: true
				}]).then(function(answers) {

					if(answers.hasparsec) {
						
						console.log("OK great, when it sets up next you will be asked to put in your server key");

					} else {
						
						console.log("OK, make an account or login here and get the server_key");
						open("https://parsec.tv/account/#self-host");
						
					}

					cb();

				});

			} else {
				cb();
			}

		}
	], function(err) {

		if(err) {
			console.log("Something went wrong, or timed out.");
			console.log(err);
			return;
		}

		startCloudrig();

	});

}

// INIT
showIntro();
checkAndSetDefaultConfig();
init();