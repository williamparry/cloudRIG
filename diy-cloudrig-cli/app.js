var figlet = require('figlet');
var inquirer = require('inquirer');
var prettyjson = require('prettyjson');
var cowsay = require('cowsay');

var config = require('./config');
var cloudrig = require('diy-cloudrig-core');

function processAnswers(answers) {

	switch(answers.cmd) {

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
	
}

function displayState(cb) {

	console.log("\nState:");

	cloudrig.getState(function(err, state) {

		var display = {

			"Instances": {
				"Active": state[0].activeInstances.length > 0 ? state[0].activeInstances.map(function(f) { return f.PublicDnsName }) : 0,
				"Pending": state[0].pendingInstances.length,
				"Shutting down": state[0].shuttingDownInstances.length
			},
			"ZeroTier": state[1],
			"Steam": state[2],
			"Microsoft Remote Desktop exists": state[3]
		}
				
		console.log("\n" + prettyjson.render(display, null, 4));

		cb();

	});

}

function mainMenu() {

	console.log("\n");
	
	var choices = ["Get State"];

	cloudrig.getState(function(err, state) {

		if(state[0].activeInstances.length > 0) {
			choices = choices.concat(["Stop CloudRig", "Open RDP", "Update AMI", "Update AMI and shut down"]);
		} else {
			choices = choices.concat(["Start CloudRig"]);
		}

		inquirer.prompt([{
			name: "cmd",
			message: "bb u want 2?\n",
			type: "rawlist",
			choices: choices
		}

		]).then(processAnswers);

	});

}

console.log(figlet.textSync('CloudRig', {
	font: 'Standard',
	horizontalLayout: 'default',
	verticalLayout: 'default'
}));

console.log(cowsay.say({
	text : "\
u know toilet duck\n\
or whatever\n\
i got some on my lip today\n\
cleaning the toilt\n\
it burned like fuck\n\
don't recommend",
e : "oO",
T : "U "
}));

console.log("Set config:\n");

console.log(prettyjson.render(config, null, 4));

cloudrig.setConfig(config);
cloudrig.setReporter(console);

var configOK =  cloudrig.getConfigState();
if(!configOK) {
	console.log("\nConfig is NOT OK. Fix before continuing");
	return;
}

console.log("\nInitialising...");

cloudrig.init(function(err, settings) {
	
	console.log("\nSettings:");

	console.log("\n" + prettyjson.render(settings, null, 4));

	displayState(mainMenu);
		
});