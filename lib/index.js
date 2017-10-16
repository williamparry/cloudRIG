"use strict";

var AWS = require('aws-sdk');
var async = require('async');
var fs = require('fs');
var getIP = require('external-ip');
var JSZip = require("jszip");
var tmp = require('tmp');

var config;
var credentials;
var settings = {};
var userDataReader;
var userDataWriter;
var iam;
var ec2;
var ssm;
var sts;
var lambda;
var cloudwatchevents;
var securityKeyPairName = "cloudrig.pem";
var cloudRIGRoleName = "cloudrig-role";
var lambdaFunctionName = "cloudrig-lambda";		// Note this is loosely coupled in lambdaHandler.js
var cloudWatchRulePrefix = "cloudrig-watch"; 	// Note this is loosely coupled in lambdaHandler.js
var lambdaFunction = fs.readFileSync('lib/lambdaHandler.js', "utf-8");

var standardFilter = [{
	Name: 'tag:cloudrig',
	Values: ['true']
}];

var reporter = (function() {

	return {

		report: function() {
			var message = Array.prototype.slice.call(arguments).join("\t");
			console.log.call(null, message);
		}

	};

}());

var RollbackHandler = function() {

	var steps = [];
	var self = this;
	
	this.clear = function() {
		steps = [];
	};

	this.add = function(step) {
		steps.push(step);
	};

	this.process = function(originalError, cb) {

		reporter.report("Something went wrong, so rolling back...");

		async.series(steps, function(err, result) {

			if(err) { 
				reporter.report("Error with rollback, please log into AWS console and check");
			} else {
				reporter.report("Successfully rolled back")
			}

			self.clear();
			
			cb(originalError);
			
		});

	}

};

// #region Get

function getPS1(script) {
	return fs.readFileSync(__dirname + "/ps1/" + script).toString();
}

function getLambdaFunction(cb) {

	lambda.listFunctions({}, function(err, data) {
		if(err) { cb(err); return; }

		cb(null, data.Functions.find(function(func) {
			return func.FunctionName === lambdaFunctionName
		}))

	});
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

function getAMI(cb) {

	reporter.report("Finding AMI");

	ec2.describeImages({
		Owners: ['self'],
		Filters: standardFilter
	}, function(err, data) {
		
		if (err) { cb(err); return; } 
		
		cb(null, data.Images[0]);
		
	});

}

function getEBSVolume(cb) {

	ec2.describeVolumes({
		Filters: standardFilter
	}, function(err, data) {
		if(err) { cb(err); return; }
		cb(null, data.Volumes);
	});

}

function getCloudRIGRole(cb) {

	reporter.report("Finding cloudRIG Role");

	var ret = {};

	async.series([

		function (cb) {

			iam.listRoles({}, function(err, data) {

				if (err) { cb(err); return; }

				data.Roles.forEach(function(role, i) {

					if(role.RoleName == cloudRIGRoleName) {

						ret.Role = role;

					}
					
				});

				cb();

			});

		},

		function(cb) {

			getInstanceProfiles(function(err, instanceProfiles) {
				
				if (err) {
					cb(err);
					return;
				}

				instanceProfiles.forEach(function(profile, i) {

					if(profile.InstanceProfileName == cloudRIGRoleName) {

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
		
		if (err) { cb(err); return; }

		cb(null, data.Reservations[0] ? data.Reservations[0].Instances : []);

	});

}

function getBestAvailabilityZone(cb) {

	reporter.report("Getting best Availability Zone");

	getAvailabilityZones(function(err, data) {

		/*
		var filters = {
			Name: "availability-zone",
			Values: data.AvailabilityZones.filter(function(zone) {
				return zone.State === "available"
			}).map(function(zone) {
				return zone.ZoneName
			})
		};

		ec2.describeSpotPriceHistory({
			Filters: filters,
			InstanceTypes: [
				"g2.2xlarge"
			], 
			ProductDescriptions: [
				"Windows"
			]
		}, function(err, data) {
			console.log(data);
		});
		*/


		var filters = {
			Name: "availability-zone",
			Values: data.AvailabilityZones.filter(function(zone) {
				return zone.State === "available"
			}).map(function(zone) {
				return zone.ZoneName
			})
		};

		async.parallel(
			data.AvailabilityZones.filter(function(zone) {
				return zone.State === "available"
			}).map(function(zone) {
				return function(availabilityZone, cb) {
					ec2.describeSpotPriceHistory({
						AvailabilityZone: availabilityZone,
						MaxResults: 1,
						InstanceTypes: [
							"g2.2xlarge"
						], 
						ProductDescriptions: [
							"Windows"
						]
					}, cb);

				}.bind(null, zone.ZoneName);
				
			}), function(err, results) {
				
				var ret = Array.prototype.concat.apply([], results.map(function(result) {
					return result.SpotPriceHistory
				})).sort(function(a,b) {
					return parseFloat(a.SpotPrice) - parseFloat(b.SpotPrice);
				})[0];

				cb(null, ret);

			}
		);

	});

}
// Get cheapest availability zone
// EBS on demand
// Check if the EBS exists
// If so, use if in same zone

function getAvailabilityZones(cb) {
	ec2.describeAvailabilityZones({}, cb);
}

function getSpotFleetInstances(SpotFleetRequestId, cb) {
	
		ec2.describeSpotFleetInstances({
			SpotFleetRequestId: SpotFleetRequestId
		}, function(err, data) {
			if (err) {
				cb(err);
			} else {
				cb(null, data.ActiveInstances);
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

function getPublicDNS(cb) {
	getActiveInstances(function(err, instances) {
		if(err) {
			cb(err);
			return;
		}
		cb(null, instances[0].PublicDnsName);
	});
}

function getBaseAMI(cb) {

	reporter.report("Finding Parsec AMI");

	ec2.describeImages({
		Filters: [{
			Name: 'name',
			Values: ['parsec-g2-ws2016-10*']
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

// #endregion

// #region Create

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
			cb(err);
			return;
		}

		cb(null, data);
		
	});

}

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

function createEBSVolume(availabilityZone, fromVolumeId, cb) {

	reporter.report("Creating EBS Volume");

	var params = {
		AvailabilityZone: availabilityZone, 
		Size: 100, 
		VolumeType: "gp2"
	};

	function create(cb) {

		ec2.createVolume(params, function(err, data) {
			
			if(err) { cb(err); return; }
	
			ec2.waitFor('volumeAvailable', {
	
				VolumeIds: [ data.VolumeId ]
	
			}, function(err) {
				
				if (err) { cb(err); return; }
				
				createTags(data.VolumeId, null, function(err) {
	
					if (err) { cb(err); return; }
	
					cb(null, data.VolumeId);

				});
				
			});

		});

	}

	if(fromVolumeId) {

		reporter.report("Creating snapshot of existing volume");
		
		ec2.createSnapshot({
			VolumeId: fromVolumeId
		}, function(err, data) {

			if(err) { cb(err); return; }

			params.SnapshotId = data.SnapshotId;

			ec2.waitFor('snapshotCompleted', {
				SnapshotIds: [ data.SnapshotId ]
			}, function(err) {

				if(err) { cb(err); return; }

				create(function(err, volumeId) {

					if(err) { cb(err); return; }

					reporter.report("Deleting source snapshot");

					ec2.deleteSnapshot({
						SnapshotId: params.SnapshotId
					}, function(err) {

						if (err) { cb(err); return; }

						cb(null, volumeId);
					})

				});

			});

		});

	} else {

		create(cb);

	}

}

function deleteEBSVolume(volumeId, cb) {
	
	reporter.report("Deleting EBS Volume " + volumeId);

	ec2.deleteVolume({
		VolumeId: volumeId
	}, function(err, data) {

		if(err) { cb(err); return; }

		cb();

	});

}

function deleteSnapshotByVolumeId(volumeId, cb) {

	reporter.report("Deleting snapshot by volume id " + volumeId);

	ec2.describeSnapshots({
		Filters: [{
			Name: "volume-id",
			Values: [ volumeId ]
		}]	
	}, function(err, data) {

		if(err) { cb(err); return; }

		ec2.deleteSnapshot({
			SnapshotId: data.Snapshots[0].SnapshotId
		}, cb);

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

function createCloudrigRole(cb) {
	
	async.series([

		function(cb) {

			var policy = `{
				"Version": "2012-10-17",
				"Statement": {
					"Effect": "Allow",
					"Principal": {
						"Service": "ec2.amazonaws.com",
						"Service": "ssm.amazonaws.com",
						"Service": "lambda.amazonaws.com",
						"Service": "spotfleet.amazonaws.com"
					},
					"Action": "sts:AssumeRole"
				}
			}`;

			reporter.report(`Creating cloudRIG role '${cloudRIGRoleName}'`);

			iam.createRole({
				AssumeRolePolicyDocument: policy,
				Path: "/", 
				RoleName: cloudRIGRoleName
			}, cb);

		},

		function(cb) {

			var policy = "arn:aws:iam::aws:policy/service-role/AmazonEC2RoleforSSM";

			reporter.report(`Attaching the policy '${policy}'`);

			iam.attachRolePolicy({
				PolicyArn: policy, 
				RoleName: cloudRIGRoleName
			}, cb);

		},

		function(cb) {

			var policy = "arn:aws:iam::aws:policy/AmazonSNSFullAccess";

			reporter.report("Attaching the policy '" + policy + "'");

			iam.attachRolePolicy({
				PolicyArn: policy, 
				RoleName: cloudRIGRoleName
			}, cb);

		},

		function(cb) {

			var policy = "arn:aws:iam::aws:policy/AmazonEC2FullAccess";

			reporter.report("Attaching the policy '" + policy + "'");

			iam.attachRolePolicy({
				PolicyArn: policy, 
				RoleName: cloudRIGRoleName
			}, cb);

		},

		function(cb) {

			var policy = "arn:aws:iam::aws:policy/CloudWatchEventsFullAccess";

			reporter.report("Attaching the policy '" + policy + "'");

			iam.attachRolePolicy({
				PolicyArn: policy, 
				RoleName: cloudRIGRoleName
			}, cb);

		},

		function(cb) {

			var policy = "arn:aws:iam::aws:policy/AWSLambdaFullAccess";

			reporter.report("Attaching the policy '" + policy + "'");

			iam.attachRolePolicy({
				PolicyArn: policy, 
				RoleName: cloudRIGRoleName
			}, cb);

		},

		function(cb) {

			var policy = "arn:aws:iam::aws:policy/service-role/AmazonEC2SpotFleetRole";

			reporter.report(`Attaching the policy '${policy}'`);
			
			iam.attachRolePolicy({
				PolicyArn: policy, 
				RoleName: cloudRIGRoleName
			}, cb);

		},

		function(cb) {

			reporter.report(`Creating instance profile '${cloudRIGRoleName}'`);

			iam.createInstanceProfile({
				InstanceProfileName: cloudRIGRoleName
			}, cb);

		},

		function(cb) {

			reporter.report(`Adding role '${cloudRIGRoleName}' to instance profile '${cloudRIGRoleName}'`);

			iam.addRoleToInstanceProfile({
				InstanceProfileName: cloudRIGRoleName, 
				RoleName: cloudRIGRoleName
			}, cb);

		}

	], cb);

}

function createKeyPair(cb) {
	
	ec2.createKeyPair({
		KeyName: "cloudrig"
	}, function(err, data) {
		
		if (err) { cb(err); return; }
		
		cb(null, data);

	});
	
}

function createLambdaFunction(cb) {

	reporter.report("Creating Lambda function");
	
	// When one is made, delete all older ones
	var zip = new JSZip();
	zip.file("index.js", lambdaFunction);
	var tmpobj = tmp.fileSync();
	zip.generateNodeStream({
		type:'nodebuffer',
		streamFiles:true
	}).pipe(fs.createWriteStream(tmpobj.name)).on('finish', function () {
		
		lambda.createFunction({
			Code: { ZipFile: fs.readFileSync(tmpobj.name) }, 
			Description: "", 
			FunctionName: lambdaFunctionName, 
			Handler: "index.handler",
			MemorySize: 128, 
			Publish: true, 
			Role: settings.cloudRIGRole,
			Runtime: "nodejs6.10", 
			Timeout: 15, 
			VpcConfig: { }
		}, cb);
		
	});

}

function createCloudWatchEvent(instanceId, cb) {

	reporter.report("Creating CloudWatch rule");

	cloudwatchevents.putRule({
		Name: cloudWatchRulePrefix + "-" + instanceId,
		EventPattern: JSON.stringify({
			"source": ["aws.ec2"],
			"detail-type": ["EC2 Instance State-change Notification"],
			"detail": {
				"state": ["stopped"],
				"instance-id": [ instanceId ]
			}
		}),
		State: "ENABLED"
	}, function (err, ruleData) {

		if (err) { cb(err); return; }

		reporter.report("Creating CloudWatch target");
		
		cloudwatchevents.putTargets({
			Rule: cloudWatchRulePrefix + "-" + instanceId,
			Targets: [{
				Arn: settings.lambda.FunctionArn,
				Id: '1'
			}]
		}, function(err) {
			
			if (err) { cb(err); return; }

			reporter.report("Give CloudWatch lambda permission");

			lambda.addPermission({
				Action: "lambda:InvokeFunction", 
				FunctionName: lambdaFunctionName,
				Principal: "events.amazonaws.com",
				SourceArn: ruleData.RuleArn, 
				StatementId: "Statement-" + instanceId

			}, cb);

		});

	});

}

// #endregion

// #region Delete

function deleteInstanceProfile(instanceProfileName, cb) {

	iam.deleteInstanceProfile({
		InstanceProfileName: instanceProfileName
	}, cb);
	
}

function deleteSpotFleetRequest(spotFleetRequestId, cb) {
	
	reporter.report("Deleting spot fleet request");

	ec2.cancelSpotFleetRequests({
		SpotFleetRequestIds: [ spotFleetRequestId ], 
		 TerminateInstances: true
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
		
		if (err) { cb(err); return; }

		cb(null, data);
		
	});

}
	
// #endregion

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
	return ["AWSCredentialsProfile", "AWSMaxPrice", "AWSRegion", "ParsecServerId"];
}

function validateRequiredConfig(configValues, cb) {
	
	var testCredentials = new AWS.SharedIniFileCredentials({
		profile: configValues.AWSCredentialsProfile
	});
	
	if(!testCredentials.accessKeyId) {
		cb("AWS profile not found");
	} else {
		cb();
	}

}

function stop(cb) {

	reporter.report("Stopping");

	getActiveInstances(function(err, instances) {

		sendAdminCMD("Stop-Computer -Force", function(err) {
			
			if(err) { cb(err); return; }

			setTimeout(function() { 

				ec2.waitFor('instanceTerminated', {
					
					InstanceIds: [ instances[0].InstanceId ]
			
				}, function() {
			
					reporter.report("Terminated");
					cb();
			
				});

			}, 10000);

		});


	});
}
/*
function waitForStatus(cb, instanceId, predicate, check, failureCount) {

	failureCount = failureCount || 40;
	var currentCount = 0;

	function check() {
		ec2.describeInstanceStatus({
			InstanceIds: [ instanceId ]
		}, function(err, data) {
			if(err) { cb(err); return; }
			console.log(data);
			if(predicate == "InstanceStatus") {
				if(data.InstanceStatus.Status == check) {
					cb()
				}
			} else if(predicate == "InstanceState") {
				if(data.InstanceState.Name == check) {
					cb();
				}
			} else {
				failureCount++;
				if(currentCount == failureCount) {
					cb("Timeout");
				} else {
					setTimeout(check, 5000);
				}
			}
		})
	}
}
*/
// If no AMI, make it and run
// If instance exists, start it again
function start(cb) {

	var startFunctions = [];
	var state = {};
	var rollback = new RollbackHandler();

	var _waitForSSM = function(cb) {

		reporter.report("Waiting for SSM");

		function check() {

			ssm.describeInstanceInformation({
				Filters: [{
					Key: "InstanceIds",
					Values: [state.instance.InstanceId]
				}]
			}, function(err, data) {
				
				if (err) { cb(err); return; }
				
				if(data.InstanceInformationList.length > 0) {
					cb();
				} else {
					setTimeout(check, 2000);	
				}

			});

		}

		check();

	};

	var _waitForInstanceOk = function(cb) {

		reporter.report("Waiting for our instance to be ready");

		function check() {
			
			getActiveInstances(function(err, instances) {
				
				if (err) { cb(err); return; }

				if(instances.length > 0) {
					
					ec2.waitFor("instanceStatusOk", {
						InstanceIds: [ instances[0].InstanceId ]
					}, cb);

				} else {

					setTimeout(check, 1000);
				}

			});

		}

		check();

	};

	var _reboot = function(cb) {

		reporter.report("Rebooting");

		ec2.rebootInstances({
			InstanceIds: [ state.instance.InstanceId ]
		}, cb);
		
	};

	var _getBestAvailabilityZone = function(cb) {

		getBestAvailabilityZone(function(err, bestAvailabilityZone) {
			
			if(err) { cb(err); return; }

			state.availabilityZone = bestAvailabilityZone.AvailabilityZone
			
			reporter.report("It's " + state.availabilityZone + ": $" + bestAvailabilityZone.SpotPrice + " / Max price: $" + config.AWSMaxPrice)

			if(parseFloat(bestAvailabilityZone.SpotPrice) >= parseFloat(config.AWSMaxPrice)) {
				cb("Your max price is too low right now. Either wait for the cost to go down, or raise your max price"); return;
			}
			cb();

		});
	};

	var _createCloudWatchEvent = function(cb) {

		// TODO: Add rollback
		createCloudWatchEvent(state.instance.InstanceId, cb);
		
	};

	var _getBaseAMI = function(cb) {

		getBaseAMI(function(err, baseAMI) {

			if(err) { cb(err); return; }

			state.ImageId = baseAMI.ImageId;

			cb()
		})
	};

	var _attachEBSVolume = function(cb) {

		reporter.report("Getting EBS Volume")

		function attachVolume() {

			ec2.attachVolume({
				Device: "xvdb", 
				InstanceId: state.instance.InstanceId,
				VolumeId: state.volumeId
			}, function(err, data) {
			
				if (err) { cb(err); return; }
				cb();
			
			});

		}

		getEBSVolume(function(err, volumes) {

			if (err) { cb(err); return; }
			
			// Exists
			if(volumes[0]) {

				reporter.report("Volume found");

				// Get latest volume
				volumes.sort(function(volume1, volume2) {
					return volume1.CreateTime - volume2.CreateTime
				})

				// Different zone
				if(volumes[0].AvailabilityZone !== state.availabilityZone) {

					cb("Your EBS volume cannot switch availability zone at the moment.");
					return;

					reporter.report("Volume does not exist in the availability zone, so making a snapshot to transfer across.");

					// Check if a version exists in that zone

					rollback.add(deleteSnapshotByVolumeId.bind(null, volumes[0].VolumeId));

					createEBSVolume(state.availabilityZone, volumes[0].VolumeId, function(err, volumeId) {

						if (err) { cb(err); return; }

						state.volumeId = volumeId;

						rollback.add(deleteEBSVolume.bind(null, volumeId));

						reporter.report("Deleting existing volume");

						deleteEBSVolume(volumes[0].VolumeId, function(err, data) {
							
							if (err) { cb(err); return; }

							attachVolume();

						});

					});

				} else {

					state.volumeId = volumes[0].VolumeId;
					attachVolume();
					
				}

			} else {

				reporter.report("No volume found")

				createEBSVolume(state.availabilityZone, null, function(err, volumeId) {

					if (err) { cb(err); return; }

					rollback.add(deleteEBSVolume.bind(null, volumeId));

					state.volumeId = volumeId;

					attachVolume();

				});

			}

		});

	}

	var _request = function(cb) {

		var params = {
			SpotFleetRequestConfig: {
				
				IamFleetRole: settings.cloudRIGRole,
				InstanceInterruptionBehavior: "stop",
				LaunchSpecifications: [{
					IamInstanceProfile: {
						Arn: settings.cloudRigInstanceProfile
					},
					UserData: new Buffer(`
					network_server_start_port=8000
					app_host=1
					server_key=${config.ParsecServerId}
					app_check_user_data=1
					app_first_run=0`).toString("base64"),
					Placement: {
						AvailabilityZone: state.availabilityZone
					},
					ImageId: state.ImageId,
					InstanceType: "g2.2xlarge",
					KeyName: settings.KeyName,
					SecurityGroups: [{
						GroupId: settings.SecurityGroupId
					}]
	
				}],
				Type: "maintain",
				SpotPrice: config.AWSMaxPrice || "0.4", 
				TargetCapacity: 1
			}
			
		};
		
		ec2.requestSpotFleet(params, function(err, data) {

			if (err) { cb(err); return; }

			rollback.add(deleteSpotFleetRequest.bind(null, data.SpotFleetRequestId));
			
			reporter.report("Request made: " +  data.SpotFleetRequestId);

			reporter.report("Waiting for fulfillment");
			
			var check = function() {

				getSpotFleetInstances(data.SpotFleetRequestId, function(err, instances) {
					
					if(err) { cb(err); return; }

					if(instances.length > 0) {
						
						state.instance = instances[0];

						cb();

					} else {
						setTimeout(check, 2000);
					}

				});

			}

			check();
			
		});

	};

	var _tag = function(cb) {

		reporter.report("Tagging instance");
		
		createTags(state.instance.InstanceId, null, function(err) {
			
			if (err) { cb(err); return; }
			
			cb();
			
		});

	};
	
	getAMI(function(err, ami) {

		if(err) { cb(err); return; }

		// TODO: Check if an AMI is in progress (for quick start/stop occasions)
		if(ami) {

			reporter.report("Starting your last cloudRIG");
			
			state.fromBase = false;

			state.ImageId = ami.ImageId;

			startFunctions = [

				_getBestAvailabilityZone,
				
				_request,

				_tag,
	
				_waitForInstanceOk,

				_waitForSSM,

				_attachEBSVolume,

				_reboot,
	
				_createCloudWatchEvent

			]

		} else {

			reporter.report("Making your cloudRIG! This happens once and may take a while.");
			
			state.fromBase = true;

			startFunctions = [
	
				_getBaseAMI,
				
				_getBestAvailabilityZone,

				_request,

				_tag,
	
				_waitForInstanceOk,

				_waitForSSM,

				_attachEBSVolume,
				
				function(cb) {
					reporter.report("Installing Folders");
					sendMessage(getPS1("Install-Folders.ps1"), cb);
				},
	
				function(cb) {
					reporter.report("Initialising Drive");
					sendMessage(getPS1("Set-Drive.ps1"), cb);
				},
	
				function(cb) {
					reporter.report("Setting Admin CMD Watcher");
					sendMessage(getPS1("Set-Admin-CMD-Watcher.ps1"), cb);
				},

				_reboot,
	
				_createCloudWatchEvent
	
			];

		}

		async.series(startFunctions, function(err, data) {
	
			if (err) {
				rollback.process(err, cb);
				return;
			}

			rollback.clear();
			
			cb(null, state.fromBase);
	
		});

	});

}

function sendAdminCMD(commands, cb) {
	
	commands = !Array.isArray(commands) ? [commands] : commands;

	commands = commands.map(function(command) {
		return `Set-Content -Path c:\\cloudRIG\\Admin-CMD\\Admin-CMD.ps1 -Value '
		#${+(new Date())}
		${command}' -Force | Out-Null
		return "ok"`
	});

	sendMessage(commands, cb);

};

function sendMessage(commands, cb) {

	commands = !Array.isArray(commands) ? [commands] : commands;

	getActiveInstances(function(err, instances) {
		
		if(err) { cb(err); return; }

		var instanceId = instances[0].InstanceId

		var params = {
			DocumentName: "AWS-RunPowerShellScript",
			InstanceIds: [ instanceId ],
			ServiceRoleArn: settings.ssmRole,
			Parameters: {
				"commands": commands
			}
		};

		ssm.sendCommand(params, function(err, data) {
			
			if(err) { cb(err); return; }

			function check() {

				ssm.listCommandInvocations({
					CommandId: data.Command.CommandId,
					InstanceId: instanceId,
					Details: true
				}, function(err, data) {
					
					if(err) { cb(err); return; }
					
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

	getRequiredConfig: getRequiredConfig,

	getState: getState,

	setConfig: function(_config) {
		config = _config;
	},

	validateRequiredConfig: validateRequiredConfig,

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
		lambda = new AWS.Lambda();
		cloudwatchevents = new AWS.CloudWatchEvents();
		
		async.parallel([
			getStoppedInstances,
			getCloudRIGRole,
			getSecurityGroup,
			getIPAddress,
			getLambdaFunction,
			getKeyPair
		], function(err, results) {

			if(err) { cb(err); return; }

			var stoppedInstances 	= results[0];
			var cloudRIGRole 		= results[1];
			var securityGroup 		= results[2];
			var ipAddress 			= results[3];
			var lambda 				= results[4];
			var keyPair				= results[5];

			var questions = [];

			if(!lambda) {
				questions.push({
					q: "Shall I make a make a lambda function called '" + lambdaFunctionName + "' for cloudRIG saving?",
					m: createLambdaFunction.bind(this)
				});
			} else {
				settings.lambda = lambda;
			}

			if(!keyPair) {
				questions.push({
					q: "Shall I make a Key Pair called 'cloudrig'?",
					m: function(cb) {

						createKeyPair(function(err, data) {

							if(err) { cb(err); return; }

							userDataWriter(securityKeyPairName, data.KeyMaterial);
							reporter.report("PEM saved " + securityKeyPairName);

							cb();
							
						});
					}.bind(this)
				});
			} else {
				settings.KeyName = keyPair.KeyName;
			}
			
			if(!cloudRIGRole || (cloudRIGRole && !cloudRIGRole.Role)) {
				questions.push({
					q: "Shall I make a cloudRIGRole and instance profile called '" + cloudRIGRoleName + "' for handling the AWS services?",
					m: createCloudrigRole.bind(this)
				});
			} else {
				settings.cloudRigInstanceProfile = cloudRIGRole.InstanceProfile.Arn;
				settings.cloudRIGRole = cloudRIGRole.Role.Arn;
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
	
	getActive: getActiveInstances,

	getPending: getPendingInstances,

	getShuttingDownInstances: getShuttingDownInstances,

	getPublicDNS: getPublicDNS,

	start: start,

	stop: stop,

	sendMessage: sendMessage,

	sendAdminCMD: sendAdminCMD,
	
	_sendAdHoc: sendAdHoc,

	_getInstanceProfiles: getInstanceProfiles,

	_getSettings: getSettings,

	_deleteInstanceProfile: deleteInstanceProfile,
	
	_createSecurityGroup: createSecurityGroup

};