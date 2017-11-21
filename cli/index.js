"use strict";

var fs = require('fs');
var async = require('async');
var inquirer = require('inquirer');
var prettyjson = require('prettyjson');
var figlet = require('figlet');
var cowsay = require('cowsay');
var argv = require('yargs').argv;
var open = require("open");
var cloudrig = require('cloudriglib');

function criticalError(err) {
	console.log(cowsay.say({
		text : 'Something went wrong:',
		e : "oO",
		T : "U "
	}));
	console.log(prettyjson.render(err, null, 4));
}

function displayState(cb) {

	console.log("State:");

	cloudrig.getState(function(err, state) {
		
		console.log(prettyjson.render(state, null, 4));

		cb();

	});

}

function mainMenu() {

	cloudrig.getState(function(err, state) {
		
		if(err) {
			criticalError(err);
			return;
		}

		var choices;

		if(state.activeInstance) {

			if(!state.scheduledStop) {
				choices = ["Stop"];
			} else {
				choices = ["Get remaining time", "Cancel Scheduled Stop"];
			}

		} else {
			choices = ["Start", "Setup"];
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

				case "Start":

					cloudrig.start(function(err) {

						if(err) {
							criticalError(err);
							mainMenu();
							return;
						}
						console.log("K done");
						open("parsec:server_id=")
						mainMenu();

					});

				break;

				case "Cancel Scheduled Stop":

					cloudrig.cancelScheduledStop(function(err) {

						if(err) { criticalError(err); return; }

						console.log("Cancelled");

						mainMenu();

					});

				break;

				case "Get remaining time":

					cloudrig.getRemainingTime(function(err, data) {

						if(err) { criticalError(err); return; }

						console.log(`You have ${data.remainingMinutes} mins left`);

						mainMenu();

					});

				break;

				case "Stop":

					cloudrig.getRemainingTime(function(err, data) {
						
						if(err) { criticalError(err); return; }
						
						var choices = ["« Back", "Stop Now"];

						choices.push(`Stop in ${data.remainingMinutes} mins (AWS charges for the full hour anyway)`);

						inquirer.prompt([{
							name: "cmd",
							message: "Command:",
							type: "rawlist",
							choices: choices
						}
				
						]).then(function(answers) {

							switch(answers.cmd) {

								case "« Back":

									mainMenu();

								break;

								case "Stop Now":
									
									cloudrig.stop(function(err) {
										if(err) { criticalError(err); return; }
										setup(mainMenu);
									});

								break;

								default: 
									
									cloudrig.scheduleStop(function(err) {
										if(err) { criticalError(err); return; }
										console.log("Scheduled");
										mainMenu();
									});

								break;

							}

						});

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

	var config = cloudrig.getConfigFile();
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
		cloudrig.setConfigFile(config);

		cb();
			
	});

}

function advancedMenu(cb) {

	cloudrig.getState(function(err, state) {

		var choices = ["« Back"];

		if(state.activeInstance) {
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

	var config = cloudrig.getConfigFile();
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
			cloudrig.setConfigFile(config);
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

	cloudrig.setup(function(err, serviceSetups) {
		
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

function showIntro() {

	console.log(figlet.textSync('cloudRIG', {
		font: 'Standard',
		horizontalLayout: 'default',
		verticalLayout: 'default'
	}));
	
	console.log(cowsay.say({
		text : "This is alpha software - please use an isolated AWS account.\nDynamic 'best availability zone' is disabled in this version, sorry.\nAlso, please check your AWS console to ensure start/stop etc has worked.",
		e : "oO",
		T : "U "
	}));

}

function startCloudrig() {
	
	async.series([
		
		validateAndSetConfig,
		setup

	], function(err) {

		if(err) { criticalError(err); return; }

		mainMenu();

	});

}

// INIT
showIntro();
cloudrig.init(console.log);
startCloudrig();