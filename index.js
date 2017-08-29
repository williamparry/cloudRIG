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
		
		var display = {

			"Instances": {
				"Active": state.AWS.activeInstances.length > 0 ? state.AWS.activeInstances.map(function(f) { return f.PublicDnsName; }) : 0,
				"Pending": state.AWS.pendingInstances.length,
				"Shutting down": state.AWS.shuttingDownInstances.length,
				"Stopped": state.AWS.stoppedInstances.length
			},
			"ZeroTier": state.VPN
		};
				
		console.log(prettyjson.render(display, null, 4));

		cb();

	});

}

function mainMenu() {

	cloudrig.getState(function(err, state) {
		
		var choices;

		if(state.AWS.activeInstances.length > 0) {
			choices = ["Open cloudRIG", "Stop cloudRIG"];
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
						mainMenu();

					});

				break;

				case "Setup":

					configMenu(function() {
						setup(mainMenu);
					});

				break;

				case "Open cloudRIG":
					
					cloudrig.openRDP(function() {

						console.log("Opening");
						mainMenu();

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

		if(Object.keys(answers).filter(function(v) { return !v; }).length > 0) {
			console.log("You have an empty value. Gotta have all dem values mate.");
			configMenu(cb);
		} else {

			Object.assign(config, answers);
			setConfigFile(config);

			validateAndSetConfig(cb);
			
		}
	
	});

}

function advancedMenu(cb) {

	cloudrig.getState(function(err, state) {

		var choices = ["« Back"];

		if(state.AWS.activeInstances.length > 0) {
			choices.push(
				"Send Command",
				"Join Remote to VPN",
				"Get Remote VPN Address"
			);
		}

		choices.push(
			"Join Host to VPN",
			"Get Windows Password",
			"Create Key Pair",
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
						
						cloudrig._Instance._sendAdHoc(function(err, d) {

							console.log("Response");
							console.log(d);
							
							advancedMenu();

						}, answers.sendCMD);
					
					});
					
				break;

				case "Join Host to VPN":
					cloudrig._VPN.start(advancedMenu.bind(null, cb));
				break;

				case "Join Remote to VPN":

					cloudrig._Instance.sendMessage(cloudrig._VPN.getRemoteInfoCommand(), function(err, resp) {
						console.log(resp);
						var address = JSON.parse(resp).address;
						console.log(address);
						cloudrig._VPN.addCloudrigAddressToVPN(address, function() {
							cloudrig._Instance.sendMessage(cloudrig._VPN.getRemoteJoinCommand(), function(err, resp) {
								console.log("Done");
								advancedMenu(cb);
							});
						});
					});

				break;

				case "Get Remote VPN Address":

					cloudrig._Instance.sendMessage(cloudrig._VPN.getRemoteInfoCommand(), function(err, resp) {
						console.log(JSON.parse(resp).address);
						advancedMenu(cb);
					});

				break;
				
				case "Get Windows Password":
		
					cloudrig._Instance.getPassword(function(err, password) {
						console.log("---------------------------------");
						console.log("Password: " + password);
						console.log("---------------------------------");
						advancedMenu(cb);
					});

				break;

				case "Clean up Instance Profiles":
					
					cloudrig._Instance._getInstanceProfiles(function(err, data) {
						
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
									return cloudrig._Instance._deleteInstanceProfile.bind(null, answer);
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
					cloudrig._Instance._createSecurityGroup(advancedMenu.bind(null, cb));
				break;

				case "Create Key Pair":
					cloudrig._Instance._createKeyPair(advancedMenu.bind(null, cb));
				break;
				
			}

		});

	});

}

function validateRequiredSoftware(cb) {

	console.log("Validating required software");

	cloudrig.validateRequiredSoftware(function(err, software) {
		
		if(err) {
			cb(err);
			return;
		}

		var errors = [];
		
		Object.keys(software).forEach(function(key) {
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

	console.log("Validating required config");

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
	
	console.log("Validating and setting config");

	var config = getConfigFile();
	var configState = cloudrig.getRequiredConfig();
	var questions = [];

	Object.keys(configState).forEach(function(serviceName) {

		configState[serviceName].forEach(function(serviceConfigKey) {

			if(!config[serviceConfigKey]) {
				questions.push({
					type: "input",
					name: serviceConfigKey,
					message: "Enter " + serviceConfigKey
				});
			}
		});

	});
	
	if(questions.length > 0) {
		
		console.log("You're missing some values in your config. Enter them below:");

		inquirer.prompt(questions).then(function(answers) {

			// TODO: cloudrig.validateRequiredConfig()

			Object.assign(config, answers);
			setConfigFile(config);
			validateAndSetConfig(cb);

		});

	} else {

		console.log("Setting config");
		var displayConfig = Object.assign({}, config);
		displayConfig.ZeroTierAPIKey = "(set)";
		
		console.log(prettyjson.render(displayConfig, null, 4));
		cloudrig.setConfig(config);

		cb(null);

	}

}

function setup(cb) {

	console.log("Setting up");

	cloudrig.setup(userDataFileReader, userDataFileWriter, function(err, serviceSetups) {
		
		if(err) {
			cb(err);
			return;
		}

		var questions = [];

		Object.keys(serviceSetups).forEach(function(serviceSetup) {

			var serviceSetupQuestions = serviceSetups[serviceSetup];

			if(serviceSetupQuestions) {

				serviceSetupQuestions.forEach(function(question) {

					questions.push({
						text: "[" + serviceSetup + "] " + question.q,
						func: question.m
					});

				});

			}

		});

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
			cb(null);

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

	console.log("https://www.cloudrig.io");

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

function setAWSCreds(cb) {

	console.log("Installing the wizard...");
	var child_process = require('child_process');
	child_process.execSync("npm install nightmare");

	console.log("Done. Starting wizard...");
	var Nightmare = require('nightmare');
	var nightmare = Nightmare({
		show: true,
		//openDevTools: true,
		waitTimeout: 60000
	});


	// TODO: Make this more robust - remove fixed waits
	nightmare
	.viewport(1024, 768)
	.goto('https://console.aws.amazon.com/iam/home?region=ap-southeast-2#/users$new?step=details')
	.wait('#ap_email')
	.evaluate(function () {
		/*jshint browser: true */
		var el = document.createElement("div");
		el.innerHTML = "Please log in. The wizard will do the rest.";
		el.style.position = "absolute";
		el.style.top = "0";
		el.style.left = "0";
		el.style.zIndex = "10";
		el.style.background = "orange";
		el.style.width = "100%";
		document.body.appendChild(el);
		
		return true;
	})
	.wait('#awsui-textfield-3')
	.type('#awsui-textfield-3', 'cloudrig')
	.wait(1000)
	.click('awsui-checkbox[name=accessKey] label')
	.wait(1000)
	.click('awsui-button[text^=Next] button')
	.wait(5000)
	//.wait('[data-item-id] awsui-checkbox label')
	.click('[data-item-id] awsui-checkbox label')
	.wait(5000)
	.click('.wizard-next-button')
	//.wait('.permissions-summary')
	.wait(1000)
	.click('.wizard-next-button')
	.wait('hide-credential a')
	.click('hide-credential a')
	.evaluate(function() {
		return {
			aws_access_key_id: document.querySelector('.access-key-id span').innerHTML.trim(),
			aws_secret_access_key: document.querySelector('hide-credential .credential').innerHTML
		};
	})
	.end()
	.then(function (result) {
		
		var creds = `[cloudrig]
aws_access_key_id = ${result.aws_access_key_id}
aws_secret_access_key = ${result.aws_secret_access_key}`;

		if(fs.existsSync(AWSCredsFile)) {
			var contents = fs.appendFileSync(AWSCredsFile, creds);
		} else {
			fs.writeFileSync(AWSCredsFile, creds);
		}
		cb(null);

	})
	.catch(function (err) {
		cb(err);
	});

}

function startCloudrig() {
	
	async.series([

		validateRequiredSoftware,
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
					name: "startwizard",
					message: "I can't find your AWS credentials file in ~/.aws/credentials. Start the cloudrig credentials wizard?",
					default: true
				}]).then(function(answers) {
					if(answers.startwizard) {
						setAWSCreds(done);
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
					name: "startwizard",
					message: "Looks like your have a credentials file but no 'cloudrig' profile. Shall I make one?",
					default: true
				}]).then(function(answers) {
					if(answers.startwizard) {
						setAWSCreds(done);
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

			var zeroTierAPIKey = getConfigFile().ZeroTierAPIKey;
			
			if(!zeroTierAPIKey) {

				inquirer.prompt([{
					type: "confirm",
					name: "haszerotier",
					message: "Do you a ZeroTier account and an API key?",
					default: true
				}]).then(function(answers) {

					if(answers.haszerotier) {
						
						console.log("OK great, when it sets up next you will be asked to put in your API key");

					} else {
						
						console.log("OK, make an account or login here and click \"[show]\" under \"API Access Tokens\"");
						open("https://my.zerotier.com/");
						
					}

					setTimeout(cb, 3000);

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
setReporter();
init();