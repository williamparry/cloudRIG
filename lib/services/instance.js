/*
BUG:	waitFor is returning early (possibly associated with error handling)
TODO:	Add ability to get current price and show user
TODO:	Change some of the get functions to use newer JS array methods like .find()
TODO:	Optimise to use getActiveInstances() rather than getState() if only active needed
*/

"use strict";

var AWS = require('aws-sdk');
var async = require('async');
var fs = require('fs');
var crypto = require("crypto");
var getIP = require('external-ip');
var reporter = require('../helpers/reporter')();
var btoa = require('btoa');

var config;
var credentials;
var settings = {};
var userDataReader;
var userDataWriter;
var iam;
var ec2;
var ssm;
var sts;
var securityKeyPairName = "cloudrig.pem";
var ssmRoleName = "cloudrig-ssm";
var standardFilter = [{
	Name: 'tag:cloudrig',
	Values: ['true']
}];

//--------------------------------------------------
// Get
//--------------------------------------------------

function getPS1(script) {
	return fs.readFileSync(__dirname + "/ps1/" + script).toString();
}

function getInstanceProfiles(cb) {

	iam.listInstanceProfiles({}, function(err, data) {
		
		if (err) {
			cb(err);
			return;
		}

		cb(null, data.InstanceProfiles);

	});
}

function getSSMRole(cb) {

	reporter.report("Finding SSM Role");

	var ret = {};

	async.series([

		function (cb) {

			iam.listRoles({}, function(err, data) {

				if (err) {
					cb(err);
					return;
				}

				data.Roles.forEach(function(role, i) {

					if(role.RoleName == ssmRoleName) {

						ret.Role = role;

					}
					
				});

				cb(null);

			});

		},

		function(cb) {

			getInstanceProfiles(function(err, instanceProfiles) {
				
				if (err) {
					cb(err);
					return;
				}

				instanceProfiles.forEach(function(profile, i) {

					if(profile.InstanceProfileName == ssmRoleName) {

						ret.InstanceProfile = profile;

					}
					
				});

				cb(null);

			});

		}

	], function(err, results) {

		if(err) {
			cb(err);
			return;
		}

		cb(null, ret);

	});	

}

function getIdFromCredentials(cb) {

	reporter.report("Getting ID from credentials");

	sts.getCallerIdentity({}, function(err, data) {

		if(err) {
			cb(err);
			return;
		}

		cb(null, data);

	});

}

function getSecurityGroup(cb) {

	reporter.report("Finding Security Group");

	ec2.describeSecurityGroups({
		Filters: standardFilter
	}, function(err, data) {
		
		if (err) {
			cb(err); 
		} else {
			cb(null, data.SecurityGroups[0]);
		}
		
	});
}

function getKeyPair(cb) {

	reporter.report("Finding Key Pair");

	ec2.describeKeyPairs({
		KeyNames: ["cloudrig"]
	}, function(err, data) {
		// Error if there are no keys
		// TODO: Warn if there's more than 1
		if (err) {
			cb(null, null); 
		} else {
			cb(null, data.KeyPairs[0]);
		}
		
	});
}

function getActiveInstances(cb) {

	ec2.describeInstances({
		Filters: standardFilter.concat([{
			Name: 'instance-state-name',
			Values: ['running']
		}])
	}, function(err, data) {
		
		if (err) {
			cb(err);
		} else {
			cb(null, data.Reservations[0] ? data.Reservations[0].Instances : []);
		}

	});

}

function getStoppedInstances(cb) {

	ec2.describeInstances({
		Filters: standardFilter.concat([{
			Name: 'instance-state-name',
			Values: ['stopped']
		}])
	}, function(err, data) {
		
		if (err) {
			cb(err); 
		} else {
			cb(null, data.Reservations[0] ? data.Reservations[0].Instances : []);
		}

	});

}

function getPendingInstances(cb) {

	ec2.describeInstances({
		Filters: standardFilter.concat([{
			Name: 'instance-state-name',
			Values: ['pending']
		}])
	}, function(err, data) {
		
		if (err) {
			cb(err); 
		} else {
			cb(null, data.Reservations[0] ? data.Reservations[0].Instances : []);
		}

	});

}

function getShuttingDownInstances(cb) {
	
	ec2.describeInstances({
		Filters: standardFilter.concat([{
			Name: 'instance-state-name',
			Values: ['shutting-down']
		}])
	}, function(err, data) {
		
		if (err) {
			cb(err); 
		} else {
			cb(null, data.Reservations[0] ? data.Reservations[0].Instances : []);
		}

	});

}

function getPassword(cb) {

	reporter.report(`Getting password`);

	getState(function(err, state) {

		if(err) {
			cb(err);
			return;
		}

		ec2.getPasswordData({InstanceId: state.activeInstances[0].InstanceId}, function (err, data) {
			
			if(err) {
				cb(err);
				return;
			}
	
			var password = crypto.privateDecrypt({
	
				key: userDataReader(securityKeyPairName),
	
				padding: crypto.constants.RSA_PKCS1_PADDING
	
			}, new Buffer(data.PasswordData, "base64")).toString("utf8");
	
			cb(null, password);
	
		});

	});

}

function getPublicDNS(cb) {
	getState(function(err, state) {
		if(err) {
			cb(err);
			return;
		}
		cb(null, state.activeInstances[0].PublicDnsName);
	});
}

function getBaseAMI(cb) {

	reporter.report("Finding Base Windows 2016 AMI");

	ec2.describeImages({
		Owners: ['amazon'],
		Filters: [{
			Name: 'name',
			Values: ['Windows_Server-2016-English-Full-Base-*']
		}]
	}, function(err, data) {
		if (err) {
			cb(err);
			return;
		}
		cb(null, data.Images[data.Images.length - 1]);
	});

}

function getIPAddress(cb) {

	reporter.report("Getting IP Address");

	getIP()(function (err, ip) {

		if (err) {
			cb(err);
			return;
		}
		
		cb(null, ip, ip.indexOf(".") == -1);
	});

}

function getSettings() {
	return settings;
}

//--------------------------------------------------
// Create
//--------------------------------------------------

function createSecurityGroup(cb) {
	
	reporter.report("Creating security group");

	ec2.createSecurityGroup({
		Description: "cloudrig",
		GroupName: "cloudrig"
	}, function(err, securityGroupData) {

		if (err) {
			cb(err);
			return;
		}

		getIPAddress(function(err, ip, ipis6) {

			if (err) {
				cb(err);
				return;
			}

			reporter.report("Tagging Security Group");
			createTags(securityGroupData.GroupId, null, function(err) {

				if (err) {
					cb(err);
					return;
				}

				addIPToSecurityGroup(securityGroupData.GroupId, ip, ipis6, cb);

			});

		});

	});

}

function addIPToSecurityGroup(securityGroupId, ip, ipis6, cb) {
	
	reporter.report("Adding IP Address to Security Group");

	var params = {
		FromPort: -1,
		ToPort: -1,
		IpProtocol: '-1'
	};

	if(!ipis6) {
		params.IpRanges = [{
			CidrIp: ip + "/32"
		}];
	} else {
		params.Ipv6Ranges = [{
			CidrIpv6: ip + "/128"
		}];
	}
	
	ec2.authorizeSecurityGroupIngress({
		GroupId: securityGroupId,
		IpPermissions: [params]
	}, function (err, data) {

		if(err) {
			cb(err);
			return;
		}

		cb(null);

	});

}

function createSSMRole(cb) {
	
	async.series([

		function(cb) {

			var policy = `{
				"Version": "2012-10-17",
				"Statement": {
					"Effect": "Allow",
					"Principal": {
						"Service": "ec2.amazonaws.com",
						"Service": "ssm.amazonaws.com"
					},
					"Action": "sts:AssumeRole"
				}
			}`;

			reporter.report(`Creating SSM role '${ssmRoleName}'`);

			iam.createRole({
				AssumeRolePolicyDocument: policy,
				Path: "/", 
				RoleName: ssmRoleName
			}, cb);

		},

		function(cb) {

			var policy = "arn:aws:iam::aws:policy/service-role/AmazonEC2RoleforSSM";

			reporter.report(`Attaching the policy '${policy}'`);

			iam.attachRolePolicy({
				PolicyArn: policy, 
				RoleName: ssmRoleName
			}, cb);

		},

		function(cb) {

			var policy = "arn:aws:iam::aws:policy/AmazonSNSFullAccess";

			reporter.report("Attaching the policy '" + policy + "'");

			iam.attachRolePolicy({
				PolicyArn: policy, 
				RoleName: ssmRoleName
			}, cb);

		},

		function(cb) {

			reporter.report(`Creating instance profile '${ssmRoleName}'`);

			iam.createInstanceProfile({
				InstanceProfileName: ssmRoleName
			}, cb);

		},

		function(cb) {

			reporter.report(`Adding role '${ssmRoleName}' to instance profile '${ssmRoleName}'`);

			iam.addRoleToInstanceProfile({
				InstanceProfileName: ssmRoleName, 
				RoleName: ssmRoleName
			}, cb);

		}

	], cb);

}

function createKeyPair(cb) {
	
	ec2.createKeyPair({
		KeyName: "cloudrig"
	}, function(err, data) {
		
		if (err) {
			reporter.report(err.stack, "error");
			cb("error");
		} else {
			cb(data);
		}

	});
	
}

function sendAdHoc(cb, cmd, admin) {

	cmd = cmd || getPS1(".adhoc.ps1");
	
	(!admin ? sendMessage : sendAdminCMD)(cmd, function(err, d) {
		if(err) {
			cb(err);
			return;
		}
		cb(null, d);
	});

}

//--------------------------------------------------
// Helpers
//--------------------------------------------------

function createTags(resourceId, additionalTags, cb) {

	var tags = [{
		Key: "cloudrig", 
		Value: "true"
	}];

	if(additionalTags) {
		tags = tags.concat(additionalTags);
	}

	ec2.createTags({
		Resources: [resourceId], 
		Tags: tags
	}, function(err, data) {
		
		if (err) {
			reporter.report(err.stack, "error");
			cb(err);
			return;
		}

		cb(null, data);
		
	});

}

//--------------------------------------------------
// Delete
//--------------------------------------------------

function deleteInstanceProfile(instanceProfileName, cb) {

	iam.deleteInstanceProfile({
		InstanceProfileName: instanceProfileName
	}, cb);
	
}

function deleteTags(resourceId, cb) {

	var params = {
		Resources: [resourceId], 
		Tags: [{
			Key: "cloudrig", 
			Value: "true"
		}]
	};
	
	ec2.deleteTags(params, function(err, data) {
		
		if (err) {
			reporter.report(err.stack, "error");
			cb(err);
			return;
		}

		cb(null, data);
		
	});

}

//--------------------------------------------------
// IService
//--------------------------------------------------

function getState(cb) {
	
	async.parallel([
		
		getActiveInstances,
		getPendingInstances,
		getShuttingDownInstances,
		getStoppedInstances

	], function(err, results) {
		
		if(err) {
			cb(err);
			return;
		}

		cb(null, {
			activeInstances: results[0],
			pendingInstances: results[1],
			shuttingDownInstances: results[2],
			stoppedInstances: results[3]
		});

	});

}

function getRequiredConfig() {
	return ["AWSCredentialsProfile", "AWSRegion"];
}

function validateRequiredConfig(configValues, cb) {

	var testCredentials = new AWS.SharedIniFileCredentials({
		profile: configValues[0]
	});
	
	if(!credentials.accessKeyId) {
		cb(null, ["AWS profile not found"]);
	} else {
		cb(null, true);
	}

	/*
	TODO: Investigate running all setup commands but with DryRun parameter set
	
	*/

}

function validateRequiredSoftware(cb) {
	cb(null, true);
}

//--------------------------------------------------
// Instance
//--------------------------------------------------

function restartSteam(cb) {
	sendAdminCMD(getPS1("Administrator/Restart-Steam.ps1"), cb );
}

// If no AMI, make it and run
// If instance exists, start it again
function start(cb) {

	var startFunctions;
	var fromBase;

	// Shared functions
	var waitForSSM = function(instance, cb) {

		reporter.report("Waiting for SSM");

		function check() {

			ssm.describeInstanceInformation({
				Filters: [{
					Key: "InstanceIds",
					Values: [instance.InstanceId]
				}]
			}, function(err, data) {
				
				if (err) {

					cb(err);
					return;

				} else if(data.InstanceInformationList.length > 0) {

					cb(null, instance);

				} else {
					setTimeout(check, 2000);	
				}

			});

		}

		check();

	};

	var waitForInstanceOk = function(instanceId, cb) {

		reporter.report("Waiting for our instance to be ready");

		function check() {
			
			getActiveInstances(function(err, instances) {
				
				if(err) {

					cb(err);
					return;

				} else if(instances.length > 0) {
					
					reporter.report("Waiting for our instance to be OK");

					ec2.waitFor('instanceStatusOk', {

						InstanceIds: [ instanceId ]

					}, function(err, data) {
						
						if (err) {
							cb(err);
							return;
						}
						
						cb(null, instances[0]);
						
					});

				} else {

					setTimeout(check, 5000);
				}

			});

		}

		check();

	};

	if(settings.InstanceId) {

		reporter.report("Starting from stopped instance");

		fromBase = false;

		startFunctions = [

			// Start Instance
			function(cb) {

				ec2.startInstances({
					InstanceIds: [ settings.InstanceId ]
				}, function(err, data) {
					
					if(err) {
						cb(err);
						return;
					}

					cb(null, data.StartingInstances[0].InstanceId);

				});

			},

			waitForInstanceOk,

			waitForSSM

		];

	} else {
		
		reporter.report("Making your cloudRIG! This happens once and may take a while.");
		
		fromBase = true;

		startFunctions = [

			getBaseAMI,

			// Run instance with stock Windows image
			function(baseAMI, cb) {

				ec2.runInstances({

					IamInstanceProfile: {
						Arn: settings.ssmInstanceProfile
					},
					MinCount: 1,
					MaxCount: 1,
					BlockDeviceMappings: [{
						DeviceName: "/dev/sda1", 
						Ebs: {
							DeleteOnTermination: true, 
							VolumeSize: 256, 
							VolumeType: "gp2"
						}
					}],
					EbsOptimized: true,
					Placement: {
						Tenancy: "dedicated"
					},
					ImageId: baseAMI.ImageId,
					InstanceType: "g2.2xlarge",
					KeyName: settings.KeyName,
					SecurityGroupIds: [ settings.SecurityGroupId ]

				}, function(err, data) {

					if(err) {
						cb(err);
						return;
					}

					var instanceId = data.Instances[0].InstanceId;
					cb(null, instanceId);
					
				});

			},

			// Tag
			function(instanceId, cb) {

				reporter.report("Tagging instance");

				createTags(instanceId, null, function(err) {
					
					if (err) { 
						cb(err);
						return;
					}
					
					cb(null, instanceId);
					
				});

			},

			waitForInstanceOk,

			waitForSSM,
			
			function(instance, cb) {
				reporter.report("Installing Folders");
				sendMessage(getPS1("Install-Folders.ps1"), function () { cb(null, instance); });
			},

			function(instance, cb) {
				reporter.report("Installing Device Management");
				sendMessage(getPS1("Install-Device-Management.ps1"), function () { cb(null, instance); });
			},

			function(instance, cb) {
				reporter.report("Installing Launch Tools");
				sendMessage(getPS1("Install-Launch-Tools.ps1"), function () { cb(null, instance); });
			},

			function(instance, cb) {
				reporter.report("Installing Steam");
				sendMessage(getPS1("Install-Steam.ps1"), function () { cb(null, instance); });
			},
			
			function(instance, cb) {
				reporter.report("Installing ZeroTier (VPN)");
				sendMessage(getPS1("Install-ZeroTier.ps1"), function () { cb(null, instance); });
			},
			
			function(instance, cb) {
				reporter.report("Installing Graphics Driver");
				sendMessage(getPS1("Install-Graphics-Driver.ps1"), function () { cb(null, instance); });
			},

			function(instance, cb) {
				reporter.report("Installing Sound Driver");
				sendMessage(getPS1("Install-Sound-Driver.ps1"));
				// BUG: This not returning
				setTimeout(function() { cb(null, instance); }, 20000);
			},

			function(instance, cb) {
				reporter.report("Setting Display Adapter");
				sendMessage(getPS1("Set-Display-Adapter.ps1"), function () { cb(null, instance); });
			},

			function(instance, cb) {
				reporter.report("Setting Services");
				sendMessage(getPS1("Set-Services.ps1"), function () { cb(null, instance); });
			},

			function(instance, cb) {
				reporter.report("Setting Admin CMD Watcher");
				sendMessage(getPS1("Set-Admin-CMD-Watcher.ps1"), function () { cb(null, instance); });
			},

			function(instance, cb) {
				reporter.report("Setting Auto Logon");
				sendMessage(getPS1("Set-Auto-Logon.ps1"), function () { cb(null, instance); });
			},

			function(instance, cb) {
				reporter.report("Setting First Logon Script");
				sendMessage(getPS1("Set-First-Logon.ps1"), function () { cb(null, instance); });
			},

			function(instance, cb) {

				reporter.report("Rebooting");

				ec2.rebootInstances({
					InstanceIds: [ instance.InstanceId ]
				}, function(err) {

					if (err) {
						cb(err);
						return;
					}

					setTimeout(function() {
						cb(null, instance.InstanceId);
					}, 15000); // Wait for a restart
					

				});
				
			},

			waitForInstanceOk

		];

	}

	async.waterfall(startFunctions, function(err, data) {

		if (err) {
			cb(err);
			return;
		}
		
		cb(null, fromBase);

	});

}

function stop(cb) {

	getState(function(err, state) {
		
		if(err) {
			cb(err);
			return;
		}

		var instanceId = state.activeInstances[0].InstanceId;

		reporter.report("Stopping: " + instanceId);

		ec2.stopInstances({
			InstanceIds: [instanceId],
		}, function(err, data) {
			
			if(err) {
				cb(err);
				return;
			}

			ec2.waitFor('instanceStopped', {
				InstanceIds: [ instanceId ]
			}, function(err, data) {
				
				if (err) {
					cb(err);
					return;
				}

				cb();
				
			});

		});

	});

}

function sendAdminCMD(commands, cb) {
	
	commands = !Array.isArray(commands) ? [commands] : commands;

	commands = commands.map(function(command) {
		return `Set-Content -Path c:\\cloudRIG\\Admin-CMD.ps1 -Value '
		#${+(new Date())}
		${command}' -Force | Out-Null
		return "ok"`
	});

	sendMessage(commands, cb);

};

function sendMessage(commands, cb) {

	commands = !Array.isArray(commands) ? [commands] : commands;

	getState(function(err, state) {
		
		if(err) {
			cb(err);
			return;
		}

		var instanceId = state.activeInstances[0].InstanceId;

		var params = {
			DocumentName: "AWS-RunPowerShellScript",
			InstanceIds: [
				instanceId
			],
			ServiceRoleArn: settings.ssmRole,
			Parameters: {
				"commands": commands
			}
		};

		ssm.sendCommand(params, function(err, data) {
			
			if(err) {
				cb(err);
				return;
			}

			function check() {

				
				ssm.listCommandInvocations({
					CommandId: data.Command.CommandId,
					InstanceId: instanceId,
					Details: true
				}, function(err, data) {
					

					if(err) {
						cb(err);
						return;
					}
					
					if(
						data.CommandInvocations && 
						data.CommandInvocations.length > 0 && 
						data.CommandInvocations[0].Status == "Success" &&
						!!data.CommandInvocations[0].CommandPlugins[0].Output
					) {
						
						cb(null, data.CommandInvocations[0].CommandPlugins[0].Output);

					} else {

						setTimeout(check, 2000);
						
					}

				});

			}
			
			check();

		});
		

	});

}

module.exports = {
	
	id: "AWS",

	//--------------------------------------------------
	// IService
	//--------------------------------------------------

	getRequiredConfig: getRequiredConfig,

	getState: getState,

	setConfig: function(_config) {
		config = _config;
	},

	setReporter: function(_reporter) {
		reporter.set(_reporter, "AWS");
	},

	validateRequiredConfig: validateRequiredConfig,

	validateRequiredSoftware: validateRequiredSoftware,

	setup: function(_userDataReader, _userDataWriter, cb) {
		
		userDataReader = _userDataReader;
		userDataWriter = _userDataWriter;

		credentials = new AWS.SharedIniFileCredentials({
			profile: config.AWSCredentialsProfile
		});
		
		AWS.config.credentials = credentials;
		AWS.config.region = config.AWSRegion;

		iam = new AWS.IAM();
		ec2 = new AWS.EC2();
		ssm = new AWS.SSM();
		sts = new AWS.STS();
		
		async.parallel([
			getStoppedInstances,
			getSSMRole,
			getSecurityGroup,
			getKeyPair,
			getIdFromCredentials,
			getIPAddress
		], function(err, results) {

			if(err) {
				cb(err);
				return;
			}

			var stoppedInstances = results[0];
			var ssmRole = results[1];
			var securityGroup = results[2];
			var keyPair = results[3];
			var mainUserId = results[4];
			var ipAddress = results[5];

			settings.mainUserId = mainUserId.Arn;
			
			settings.InstanceId = stoppedInstances[0] ? stoppedInstances[0].InstanceId : null;
			
			var questions = [];

			if(!ssmRole || (ssmRole && !ssmRole.Role)) {
				questions.push({
					q: "Shall I make a role and instance profile called '" + ssmRoleName + "' for SSM communication?",
					m: createSSMRole.bind(this)
				});
			} else {
				settings.ssmInstanceProfile = ssmRole.InstanceProfile.Arn;
				settings.ssmRole = ssmRole.Role.Arn;
			}

			if(!keyPair) {
				questions.push({
					q: "Shall I make a Key Pair called 'cloudrig'?",
					m: function(cb) {

						createKeyPair(function(data) {

							userDataWriter(securityKeyPairName, data.KeyMaterial);
							reporter.report("PEM saved " + securityKeyPairName);

							cb(null);
							
						});
					}.bind(this)
				});
			} else {
				settings.KeyName = keyPair.KeyName;
			}

			if(!securityGroup) {
				questions.push({
					q: "Shall I make a CloudRig security group for you?",
					m: createSecurityGroup.bind(this)
				});
			} else {

				settings.SecurityGroupId = securityGroup.GroupId;

				// Check if current IP is in security group
				
				var exists = (securityGroup.IpPermissions.length !== 0 && securityGroup.IpPermissions[0][(!ipAddress[1] ? "IpRanges" : "Ipv6Ranges")].findIndex(function(range) { 
					
					return range[(!ipAddress[1] ? "CidrIp" : "CidrIpv6")].indexOf(ipAddress[0]) !== -1;

				}) !== -1);

				if(!exists) {

					questions.push({
						q: "Your IP Address "+ ipAddress[0] + " isn't in the security group. Shall I add it?",
						m: addIPToSecurityGroup.bind(this, securityGroup.GroupId, ipAddress[0], ipAddress[1])
					});

				}

			}

			cb(null, questions);

		});

	},

	//--------------------------------------------------
	// Instance
	//--------------------------------------------------
	
	getActive: getActiveInstances,

	getPending: getPendingInstances,

	getShuttingDownInstances: getShuttingDownInstances,

	getPublicDNS: getPublicDNS,

	getPassword: getPassword,

	start: start,

	stop: stop,

	sendMessage: sendMessage,

	sendAdminCMD: sendAdminCMD,

	_restartSteam: restartSteam,
	
	_sendAdHoc: sendAdHoc,

	_getInstanceProfiles: getInstanceProfiles,

	_getSettings: getSettings,

	_deleteInstanceProfile: deleteInstanceProfile,
	
	_createSecurityGroup: createSecurityGroup,

	_createKeyPair: createKeyPair

};