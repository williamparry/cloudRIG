"use strict";

var async = require("async");
var inquirer = require("inquirer");
var prettyjson = require("prettyjson");
var figlet = require("figlet");
var cowsay = require("cowsay");
var cloudrig = require("cloudriglib");

function criticalError(err) {
	console.log(
		cowsay.say({
			text: "Something went wrong:",
			e: "oO",
			T: "U "
		})
	);
	console.log(prettyjson.render(err, null, 4));
}

function displayState(cb) {
	console.log("State:");

	cloudrig.getState(function(err, state) {
		console.log(prettyjson.render(state, null, 4));

		cb();
	});
}

function newVolumeMenu(cb) {
	var config = cloudrig.getConfigFile();

	inquirer
		.prompt([
			{
				name: "cmd",
				message: "Command:",
				type: "list",
				choices: ["« Back", "100 GB", "150 GB", "250 GB"]
			}
		])
		.then(function(answers) {
			switch (answers.cmd) {
				case "« Back":
					cb();

					break;

				case "100 GB":
				case "150 GB":
				case "250 GB":
					console.log(`Creating ${answers.cmd} volume in ${config.AWSAvailabilityZone}`);

					cloudrig.createEBSVolume(config.AWSAvailabilityZone, parseInt(answers.cmd), function(err) {
						if (err) {
							criticalError(err);
							return;
						}
						console.log("Created");
						cb();
					});

					break;
			}
		});
}

function mainMenu() {
	var config = cloudrig.getConfigFile();

	cloudrig.getState(function(err, state) {
		if (err) {
			criticalError(err);
			return;
		}

		var volumesInAZ = [];
		var volumesNotInAZ = [];

		state.volumes.forEach(v => {
			if (v.AvailabilityZone === config.AWSAvailabilityZone) {
				volumesInAZ.push(v);
			} else {
				volumesNotInAZ.push(v);
			}
		});

		var choices;

		if (state.activeInstance) {
			if (!state.scheduledStop) {
				choices = ["Stop"];
			} else {
				choices = ["Get remaining time", "Cancel Scheduled Stop"];
			}
		} else {
			choices = ["Start", "Setup"];

			if (volumesInAZ.length > 0) {
				choices.push("Manage Storage");
			} else {
				choices.push("Add Storage");
			}
		}

		choices.push("Get State", "Advanced");

		console.log(`Current Spot price for ${config.AWSAvailabilityZone} is $${state.currentSpotPrice}`);

		inquirer
			.prompt([
				{
					name: "cmd",
					message: "Command:",
					type: "rawlist",
					choices: choices
				}
			])
			.then(function(answers) {
				switch (answers.cmd) {
					case "Start":
						cloudrig.start(function(err) {
							if (err) {
								criticalError(err);
								mainMenu();
								return;
							}

							mainMenu();
						});

						break;

					case "Cancel Scheduled Stop":
						cloudrig.cancelScheduledStop(function(err) {
							if (err) {
								criticalError(err);
								return;
							}

							console.log("Cancelled");

							mainMenu();
						});

						break;

					case "Get remaining time":
						cloudrig.getInstanceTimes(function(err, data) {
							if (err) {
								criticalError(err);
								return;
							}

							console.log(`You have ${data.remainingMinutes} mins left`);

							mainMenu();
						});

						break;

					case "Stop":
						cloudrig.getInstanceTimes(function(err, data) {
							if (err) {
								criticalError(err);
								return;
							}

							var choices = ["« Back", "Stop Now"];

							choices.push(`Stop in ${data.remainingMinutes} mins (AWS charges for the full hour anyway)`);

							inquirer
								.prompt([
									{
										name: "cmd",
										message: "Command:",
										type: "rawlist",
										choices: choices
									}
								])
								.then(function(answers) {
									switch (answers.cmd) {
										case "« Back":
											mainMenu();

											break;

										case "Stop Now":
											cloudrig.stop(function(err) {
												if (err) {
													criticalError(err);
													return;
												}
												setup(mainMenu);
											});

											break;

										default:
											cloudrig.scheduleStop(function(err) {
												if (err) {
													criticalError(err);
													return;
												}
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

					case "Manage Storage":
						inquirer
							.prompt([
								{
									name: "cmd",
									message: "Command:",
									type: "list",
									choices: ["« Back", "Delete volume", "Expand volume"]
								}
							])
							.then(function(answers) {
								switch (answers.cmd) {
									case "« Back":
										mainMenu();

										break;

									case "Delete volume":
										cloudrig.deleteEBSVolume(state.volumes[0].VolumeId, function(err) {
											if (err) {
												criticalError(err);
												return;
											}
											console.log("Deleted");
											mainMenu();
										});

										break;

									case "Expand volume":
										inquirer
											.prompt([
												{
													name: "val",
													message: "New size (max 1000)",
													type: "input",
													default: state.volumes[0].Size,
													validate: function(val) {
														return val >= state.volumes[0].Size && val <= 1000;
													}
												}
											])
											.then(function(answers) {
												var val = parseInt(answers.val);
												if (val === state.volumes[0].Size) {
													console.log("No change");
													mainMenu();
												} else {
													cloudrig.expandEBSVolume(state.volumes[0].VolumeId, val, function(err) {
														if (err) {
															criticalError(err);
															return;
														}
														console.log("Expanded to " + val);
														mainMenu();
													});
												}
											});

										break;

									default:
										mainMenu();

										break;
								}
							});

						break;

					case "Add Storage":
						if (volumesNotInAZ.length) {
							console.log("[!] You have a volume in another Availability Zone");
							console.log("[!] You will still be charged for it if you make another one here.");
						}

						if (volumesNotInAZ.length > 0 && volumesInAZ.length === 0) {
							inquirer
								.prompt([
									{
										name: "cmd",
										message: "Command:",
										type: "list",
										choices: ["« Back", "New volume", "Transfer here from another Availability Zone"]
									}
								])
								.then(function(answers) {
									switch (answers.cmd) {
										case "« Back":
											mainMenu();

											break;

										case "New volume":
											newVolumeMenu(mainMenu);

											break;

										case "Transfer here from another Availability Zone":
											console.log("From what Availability Zone?");
											console.log("[!] This will also delete the volume in the original Availability Zone");

											var choices = ["« Back"];
											var volumesHash = {};

											volumesNotInAZ.forEach(function(volume) {
												choices.push(`[${volume.VolumeId}] ${volume.AvailabilityZone} (${volume.Size} GB)`);
												volumesHash[volume.VolumeId] = volume;
											});

											inquirer
												.prompt([
													{
														name: "cmd",
														message: "Command:",
														type: "list",
														choices: choices
													}
												])
												.then(function(answers) {
													if (answers.cmd === "« Back") {
														mainMenu();
														return;
													}

													var volumeIdTag = answers.cmd.match(/\[(.*)\]/)[0];
													var volumeId = volumeIdTag.substr(1, volumeIdTag.length - 2);

													console.log("This will take some time - please be patient and don't interrupt the process");

													cloudrig.transferEBSVolume(volumesHash[volumeId], function(err) {
														if (err) {
															criticalError(err);
															return;
														}
														console.log("Transferred");
														mainMenu();
													});
												});

											break;

										default:
											mainMenu();

											break;
									}
								});
						} else {
							newVolumeMenu(mainMenu);
						}

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

function advancedMenu(cb) {
	cloudrig.getState(function(err, state) {
		var choices = ["« Back"];

		if (state.activeInstance) {
			choices.push("Send Command");
		}

		choices.push(
			"Delete Role",
			"Delete Instance Profile",
			"Delete Instance Profile Role",
			"Delete all Roles and Instance Profile",
			"Delete Lambda",
			"Delete Lambda Save"
		);

		inquirer
			.prompt([
				{
					name: "cmd",
					message: "Advanced",
					type: "rawlist",
					choices: choices
				}
			])
			.then(function(answers) {
				switch (answers.cmd) {
					case "« Back":
						cb();
						break;

					case "Send Command":
						console.log("Sending Ad Hoc");

						inquirer
							.prompt([
								{
									name: "sendCMD",
									message: "Command (empty will run .adhoc.ps1)",
									type: "input"
								}
							])
							.then(function(answers) {
								cloudrig._sendAdHoc(function(err, d) {
									console.log("Response");
									console.log(d);

									advancedMenu(cb);
								}, answers.sendCMD);
							});

						break;

					case "Delete Instance Profile":
						cloudrig._getInstanceProfiles(function(err, data) {
							data = data.InstanceProfiles;

							if (data.length > 0) {
								inquirer
									.prompt([
										{
											name: "toDelete",
											message: "Select instance profiles to delete",
											type: "checkbox",
											choices: data.map(function(profile) {
												return {
													name: profile.InstanceProfileName
												};
											})
										}
									])
									.then(function(answers) {
										async.parallel(
											answers.toDelete.map(function(answer) {
												return cloudrig._deleteInstanceProfileByName.bind(null, answer);
											}),
											function(err, results) {
												console.log("Done");
												advancedMenu(cb);
											}
										);
									});
							} else {
								console.log("No instance profiles");
								advancedMenu(cb);
							}
						});
						break;

					case "Delete Role":
						cloudrig.deleteRole(function(err) {
							if (err) {
								console.log(err);
							}
							advancedMenu(cb);
						});
						break;

					case "Delete Instance Profile Role":
						cloudrig.deleteInstanceProfileRole(function(err) {
							if (err) {
								console.log(err);
							}
							advancedMenu(cb);
						});
						break;

					case "Delete all Roles and Instance Profile":
						cloudrig.deleteAllRolesAndInstanceProfile(function(err) {
							if (err) {
								console.log(err);
							}
							advancedMenu(cb);
						});
						break;

					case "Delete Lambda":
						cloudrig.deleteLambda(advancedMenu.bind(null, cb));
						break;

					case "Delete Lambda Save":
						cloudrig.deleteLambdaSave(advancedMenu.bind(null, cb));
						break;

					case "Create Security Group":
						cloudrig._createSecurityGroup(advancedMenu.bind(null, cb));
						break;
				}
			});
	});
}

function populateConfigQuestions(configItems, existingValues) {
	return configItems.map(function(configItem) {
		var message = `Please enter ${configItem.title}\n\n(${configItem.help})\n`;

		var questionObject = {
			name: configItem.key,
			message: message
		};

		if (existingValues && existingValues[configItem.key]) {
			questionObject.default = existingValues[configItem.key];
		}

		if (configItem.validate) {
			questionObject.validate = configItem.validate;
		}

		// Object spread would be handy here...

		if (configItem.options) {
			questionObject.type = "list";

			if (typeof configItem.options == "function") {
				questionObject.choices = function(configItem, answers) {
					if (configItem.optionsDependsOnPreviousValues) {
						return configItem.options.apply(
							null,
							configItem.optionsDependsOnPreviousValues.map(function(o) {
								return answers[o];
							})
						);
					}
				}.bind(null, configItem);
			} else {
				questionObject.choices = configItem.options;
			}
		} else {
			questionObject.type = "input";
		}

		return questionObject;
	});
}

function configMenu(cb) {
	var config = cloudrig.getConfigFile();
	var requiredConfig = cloudrig.getRequiredConfig();

	inquirer.prompt(populateConfigQuestions(requiredConfig, config)).then(function(answers) {
		Object.assign(config, answers);
		cloudrig.setConfigFile(config);

		cb();
	});
}

function validateAndSetConfig(cb) {
	console.log("Getting config");

	var config = cloudrig.getConfigFile();
	var requiredConfig = cloudrig.getRequiredConfig();
	var questions = requiredConfig.filter(function(c) {
		return !config[c.key];
	});

	if (questions.length > 0) {
		console.log("You're missing some values in your config. Enter them below:");

		inquirer.prompt(populateConfigQuestions(questions)).then(function(answers) {
			Object.assign(config, answers);
			cloudrig.setConfigFile(config);
			validateAndSetConfig(cb);
		});
	} else {
		console.log("Validating config");

		cloudrig.validateRequiredConfig(config, function(err) {
			if (err) {
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

	cloudrig.setup(function(err, resp) {
		if (err) {
			cb(err);
			return;
		}

		if (resp.code === -1) {
			criticalError(resp.message);
			return;
		}
		// Has setup questions
		if (resp.code === 2) {
			var questions = [];

			if (resp.questions) {
				resp.questions.forEach(function(question) {
					questions.push({
						text: question.q,
						func: question.m
					});
				});
			}

			if (questions.length > 0) {
				console.log("There's some things that need to be set up. I can do them for you.");

				inquirer
					.prompt(
						questions.map(function(question, i) {
							return {
								type: "confirm",
								name: "q-" + i,
								message: question.text
							};
						})
					)
					.then(function(answers) {
						var toProcess = [];

						Object.keys(answers).forEach(function(answer, i) {
							if (answers[answer]) {
								toProcess.push(questions[i].func);
							}
						});

						if (toProcess.length > 0) {
							async.parallel(toProcess, function(err, val) {
								if (err) {
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
		} else {
			cb();
		}
	});
}

function showIntro() {
	console.log(
		figlet.textSync("cloudRIG", {
			font: "Standard",
			horizontalLayout: "default",
			verticalLayout: "default"
		})
	);

	console.log(
		cowsay.say({
			text:
				"This is alpha software - please use an isolated AWS account.\nPlease check your AWS console to ensure start/stop etc has worked.",
			e: "oO",
			T: "U "
		})
	);
}

function startCloudrig() {
	async.series([validateAndSetConfig, setup], function(err) {
		if (err) {
			criticalError(err);
			return;
		}

		mainMenu();
	});
}

// INIT
showIntro();
cloudrig.init(console.log);
startCloudrig();
