"use strict";

var AWS = require('aws-sdk');
var async = require('async');
var fs = require('fs');
var getIP = require('external-ip');
var JSZip = require("jszip");
var tmp = require('tmp');
var moment = require('moment');
var homedir = require('os').homedir();

var config;
var credentials;
var settings = {};
var reporter;
var iam;
var ec2;
var ssm;
var sts;
var lambda;
var cloudwatchevents;
var reporter;
var securityKeyPairName = "cloudrig.pem";
var cloudRIGRoleName = "cloudrig-role";
var lambdaFunctionName = "cloudrig-lambda";
var lambdaSaveFunctionName = "cloudrig-save";
var cloudWatchRulePrefix = "cloudrig-watch";
var cloudWatchSavePrefix = "cloudrig-save";
var cloudStopRulePrefix = "cloudrig-stop";
var cloudNotifyRulePrefix = "cloudrig-notify";
var cloudrigDir = homedir + "/.cloudrig/";
var standardFilter = [{
	Name: 'tag:cloudrig',
	Values: ['true']
}];

function lambdaFunction() {
	return `var AWS = require('aws-sdk');

exports.handler = (event, context, callback) => {
	
	console.log("Triggered");
	console.log(event);
	console.log(context);
	
	var ec2 = new AWS.EC2();
	var cloudwatchevents = new AWS.CloudWatchEvents();
	var lambda = new AWS.Lambda();
	
	function newImage() {

		var instanceId = event.detail["instance-id"];
		
		console.log("Creating image");
		
		ec2.createImage({
			InstanceId: instanceId,
			Name: 'cloudrig-' + new Date().getTime(),
			NoReboot: true,
			BlockDeviceMappings: [{
				DeviceName: "xvdb",
				NoDevice: ""
			}]
		}, function(err, data) {
			
			if (err) { callback(err); return; }
			
			console.log("Creating tags for " + data.ImageId);
			
			ec2.createTags({
				Resources: [data.ImageId], 
				Tags: [{
					Key: "cloudrig", 
					Value: "true"
				}]
			}, function(err) {
				
				if (err) { callback(err); return; }

				console.log("Creating Save CloudWatch")
				
            	cloudwatchevents.putRule({
            		Name: "${lambdaSaveFunctionName}-" + data.ImageId,
            		ScheduleExpression: "rate(1 minute)",
					State: "ENABLED"
            	}, function (err, ruleData) {
            
            		if (err) { callback(err); return; }
            
            		console.log("Creating Save CloudWatch target");
            		
            		cloudwatchevents.putTargets({
            			Rule: "${lambdaSaveFunctionName}-" + data.ImageId,
            			Targets: [{
            				Arn: "${settings.lambdaSave.FunctionArn}",
            				Id: '4'
            			}]
            		}, function(err) {
            			
            			if (err) { callback(err); return; }
            
            			console.log("Give Save CloudWatch lambda permission");
            
            			lambda.addPermission({
            				Action: "lambda:InvokeFunction", 
            				FunctionName: "${lambdaSaveFunctionName}",
            				Principal: "events.amazonaws.com",
            				SourceArn: ruleData.RuleArn, 
            				StatementId: "Statement-" + data.ImageId
            
            			}, function() {
							// no op
						});
            
            		});
            
            	});
				
				console.log("Finding spot fleet request id");
				
				ec2.describeSpotFleetRequests({}, function(err, data) {
					
					if (err) { callback(err); return; }
					
					var spotFleetRequestId = data.SpotFleetRequestConfigs.find(function(config) {
						return config.SpotFleetRequestState == "active";
					}).SpotFleetRequestId;
				
					console.log("Canceling spot fleet request");
					
					ec2.cancelSpotFleetRequests({
						SpotFleetRequestIds: [ spotFleetRequestId ], 
						TerminateInstances: true
					}, function(err, data) {

						if (err) { callback(err); return; }
						
						console.log("Removing lambda cloudwatch permission");

						lambda.removePermission({
							FunctionName: "${lambdaFunctionName}",
							StatementId: "Statement-" + instanceId
			
						}, function(err) {

							if (err) { callback(err); return; }

							console.log("Deleting cloud watch targets");
							
							cloudwatchevents.removeTargets({
								Ids: [ '1' ],
								Rule: "${cloudWatchRulePrefix}-" + instanceId
							}, function(err, data) {

								if (err) { callback(err); return; }

								console.log("Deleting cloud watch rule");

								cloudwatchevents.deleteRule({
									Name: "${cloudWatchRulePrefix}-" + instanceId
								}, function(err, data) {

									if (err) { callback(err); return; }

									cloudwatchevents.listRules({
										NamePrefix: "${cloudStopRulePrefix}-" + instanceId
									}, function(err, data) {
										
										if(err) { callback(err); return; }

										if(!!data.Rules[0]) {

											console.log("Deleting cloud stop targets");

											cloudwatchevents.removeTargets({
												Ids: [ '2' ],
												Rule: "${cloudStopRulePrefix}-" + instanceId
											}, function(err, data) {

												if (err) { callback(err); return; }

												console.log("Deleting cloud stop rule");

												cloudwatchevents.deleteRule({
													Name: "${cloudStopRulePrefix}-" + instanceId
												}, function(err, data) {
													
													console.log("Deleting cloud notify targets");

													cloudwatchevents.removeTargets({
														Ids: [ '3' ],
														Rule: "${cloudNotifyRulePrefix}-" + instanceId
													}, function(err, data) {

														if (err) { callback(err); return; }

														console.log("Deleting cloud notify rule");

														cloudwatchevents.deleteRule({
															Name: "${cloudNotifyRulePrefix}-" + instanceId
														}, callback);

													});

												});

											});
											
										} else {
											callback()
										}
						
									});

								});
								
							});

						});

					});
		
				});
					
			});

		});

	}

	ec2.describeImages({
		Filters: [{
			Name: 'tag:cloudrig',
			Values: ['true']
		}]
	}, function(err, data) {

		if (err) { callback(err); return; }

		if(data.Images.length > 0) {
			
			console.log("Deregister previous image");
			
			ec2.deregisterImage({
				ImageId: data.Images[0].ImageId
			}, function(err) { 
				if(err) { console.log(err); return; }
				newImage();
			});
			
		} else {
			newImage();
		}
	});
};`;

}

var lambdaSaveFunction = function() {
	
	return `var AWS = require('aws-sdk');

exports.handler = (event, context, callback) => {
	
	console.log("Triggered");
	console.log(event);
	console.log(context);
	
	var ec2 = new AWS.EC2();
	var cloudwatchevents = new AWS.CloudWatchEvents();
	var lambda = new AWS.Lambda();
    
	ec2.describeImages({
		Owners: ['self'],
		Filters: [{
        	Name: 'tag:cloudrig',
        	Values: ['true']
        }]
	}, function(err, data) {
		
		if (err) { callback(err); return; } 
		
		if(data.Images.length > 0) {
		    
		    cloudwatchevents.removeTargets({
				Ids: [ '4' ],
				Rule: "${cloudWatchSavePrefix}-" + data.Images[0].ImageId
			}, function(err) {

				if (err) { callback(err); return; }

				console.log("Deleting cloud watch rule");

				cloudwatchevents.deleteRule({
					Name: "${cloudWatchSavePrefix}-" + data.Images[0].ImageId
				}, function(err) {

					if (err) { callback(err); return; }
					
					console.log("Removing lambda cloudwatch save permission");

					lambda.removePermission({
						FunctionName: "${lambdaSaveFunctionName}",
						StatementId: "Statement-" + data.Images[0].ImageId
		
					}, callback);
					
				});
				
			});
		    
		} else {
		    callback();   
		}
		
	});
	
};`;

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

function getCredentials() {
	console.log(config);
	if(fs.existsSync(config.AWSCredentialsFile)) {
		return fs.readFileSync(config.AWSCredentialsFile)
	}
	return "";
}

function saveCredentialsFile(data) {
	fs.writeFileSync(config.AWSCredentialsFile + '-backup-' + +(new Date()), getCredentials());
	fs.writeFileSync(config.AWSCredentialsFile, data);
}

function setReporter(reporterMethod) {
	
	reporter = {
		report: function() {
			var message = Array.prototype.slice.call(arguments).join("\t");
			reporterMethod.call(null, message);
		}
	};
}

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

function getLambdaSaveFunction(cb) {
	
	lambda.listFunctions({}, function(err, data) {
		if(err) { cb(err); return; }

		cb(null, data.Functions.find(function(func) {
			return func.FunctionName === lambdaSaveFunctionName
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

function getPendingAMI(cb) {
	
	cloudwatchevents.listRules({
		NamePrefix:  cloudWatchSavePrefix + "-"
	}, function(err, data) {
		
		if(err) { cb(err); return; }
		cb(null, data.Rules[0])

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

function getEBSVolumes(cb) {

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

		if(err) { cb(err); return; }

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

// TODO: Fix ordering of arguments consistency
function getAvailabilityZoneInfo(cb, availabilityZone) {
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
}

function getCurrentSpotPrice(cb) {
	
	getAvailabilityZoneInfo(function(err, data) {
		
		if(err) { cb(err); return; }

		cb(null, data.SpotPriceHistory[0]);

	}, config.AWSAvailabilityZone)

};

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

function getStoppingInstances(cb) {
	
	ec2.describeInstances({
		Filters: standardFilter.concat([{
			Name: 'instance-state-name',
			Values: ['stopping']
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
		if(err) { cb(err); return; }
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
		
		if (err) { cb(err); return; }

		cb(null, data);
		
	});

}

function createSecurityGroup(cb) {
	
	reporter.report("Creating security group");

	ec2.createSecurityGroup({
		Description: "cloudrig",
		GroupName: "cloudrig"
	}, function(err, securityGroupData) {

		if (err) { cb(err); return; }

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

function createEBSVolume(availabilityZone, size, cb) {

	reporter.report("Creating EBS Volume");

	var params = {
		AvailabilityZone: availabilityZone, 
		Size: size, 
		VolumeType: "gp2"
	};

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

function deleteEBSVolume(volumeId, cb) {
	
	reporter.report("Deleting EBS Volume " + volumeId);

	ec2.deleteVolume({
		VolumeId: volumeId
	}, function(err, data) {

		if(err) { cb(err); return; }

		cb();

	});

	/*
	ec2.detachVolume({
		VolumeId: volumeId,
		Force: true
	}, function(err) {
		
		if(err) { cb(err); return; }

		ec2.deleteVolume({
			VolumeId: volumeId
		}, function(err, data) {
	
			if(err) { cb(err); return; }
	
			cb();
	
		});

	})
	*/
	

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
						"Service": "spotfleet.amazonaws.com",
						"Service": "events.amazonaws.com"
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

			var policy = "arn:aws:iam::aws:policy/AmazonSSMFullAccess";

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

	], function(err) {
		if(err) { cb(err); return; }
		reporter.report("Waiting for permissions to propagate");
		setTimeout(cb, 10000);
	});

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
	zip.file("index.js", lambdaFunction());
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

function createSaveLambdaFunction(cb) {

	reporter.report("Creating Lambda save function");
	
	// When one is made, delete all older ones
	var zip = new JSZip();
	zip.file("index.js", lambdaSaveFunction());
	var tmpobj = tmp.fileSync();
	zip.generateNodeStream({
		type:'nodebuffer',
		streamFiles:true
	}).pipe(fs.createWriteStream(tmpobj.name)).on('finish', function () {
		
		lambda.createFunction({
			Code: { ZipFile: fs.readFileSync(tmpobj.name) }, 
			Description: "", 
			FunctionName: lambdaSaveFunctionName, 
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

function sendAdHoc(cb, cmd) {

	cmd = cmd || getPS1(".adhoc.ps1");
	
	sendMessage(cmd, function(err, d) {
		if(err) { cb(err); return; }
		cb(null, d);
	});

}

function getState(cb) {
	
	async.parallel([
		
		getActiveInstances,
		getCloudWatchEvent,
		getStoppingInstances,
		getScheduledStop,
		getCurrentSpotPrice,
		getRemainingTime,
		getPendingAMI,
		getEBSVolumes

	], function(err, results) {

		if(err) { cb(err); return; }

		cb(null, {
			activeInstance: results[0].length > 0 ? results[0][0] : null,
			instanceReady: !!results[1],
			instanceStopping: !!results[2].length > 0,
			scheduledStop: results[3] || null,
			currentSpotPrice: results[4] ? results[4].SpotPrice : results[4],
			remainingTime: results[5].remainingMinutes,
			savingInstance: !!results[6],
			volumes: results[7]
		});

	});

}

function getRequiredConfig() {
	return ["AWSCredentialsFile", "AWSCredentialsProfile", "AWSMaxPrice", "AWSRegion", "AWSAvailabilityZone", "ParsecServerId"];
}

function validateRequiredConfig(configValues, cb) {
	
	var requiredConfig = getRequiredConfig();

	var hasError = false;

	requiredConfig.forEach(function(configKey) {
		if(!configValues[configKey]) {
			hasError = true;
			return;
		}
	});

	if(hasError) {

		cb("You are missing fields");
		return;

	} else {

		var testCredentials = new AWS.SharedIniFileCredentials({
			filename: configValues.AWSCredentialsFile,
			profile: configValues.AWSCredentialsProfile
		});

		if(!testCredentials.accessKeyId) {
			cb("AWS profile not found");
			return;
		}

	}

	cb();
	
}

function stop(cb) {

	reporter.report("Stopping");

	getActiveInstances(function(err, instances) {

		sendMessage(getPS1("Stop-Computer.ps1"), function(err) {
			
			if(err) { cb(err); return; }

			function check() {

				ec2.describeInstances({
					Filters: [{
						Name: 'instance-state-name',
						Values: ['terminated']
					}],
					InstanceIds: [ instances[0].InstanceId ]
				}, function(err, data) {
					
					if (err) { cb(err); return; }
					
					if(data.Reservations[0] && data.Reservations[0].Instances.length > 0) {
						reporter.report("Terminated");
						cb(null);
					} else {
						setTimeout(check, 2000);
					}
				});

			}

			check();

		});


	});
}

function getCloudWatchEvent(cb) {

	getActiveInstances(function(err, instances) {

		if(instances.length > 0) {
			cloudwatchevents.listRules({
				NamePrefix: cloudWatchRulePrefix + "-" + instances[0].InstanceId  
			}, function(err, data) {
				
				if(err) { cb(err); return; }
				
				cb(null, data.Rules[0])

			});

		} else {
			cb(null);
		}

	});
}

function getRemainingTime(cb) {

	getActiveInstances(function(err, instances) {

		if(err) { cb(err); return; }

		if(instances.length > 0) {

			var now = moment();
			
			cb(null, {
				now: now,
				remainingMinutes: 59 - Math.floor(now.diff(instances[0].LaunchTime, 'minutes', true) % 60),
				instanceId: instances[0].InstanceId
			})
		} else {
			cb(null, {
				remainingMinutes: '-'
			})
		}

	});

}

function getScheduledStop(cb) {

	getActiveInstances(function(err, instances) {

		if(instances.length > 0) {
			cloudwatchevents.listRules({
				NamePrefix: cloudStopRulePrefix + "-" + instances[0].InstanceId  
			}, function(err, data) {
				
				if(err) { cb(err); return; }
				cb(null, data.Rules[0])

			});

		} else {
			cb(null);
		}

	});
}

function getScheduledNotify(cb) {

	getActiveInstances(function(err, instances) {

		cloudwatchevents.listRules({
			NamePrefix: cloudNotifyRulePrefix + "-" + instances[0].InstanceId  
		}, function(err, data) {
			
			if(err) { cb(err); return; }
			cb(null, data.Rules[0])

		});

	});
}

function cancelScheduledStop(cb) {

	reporter.report("Cancelling scheduled stop");

	async.parallel([

		function(cb) {

			getScheduledStop(function(err, rule) {
				
				cloudwatchevents.removeTargets({
					Ids: [ '2' ],
					Rule: rule.Name
				}, function(err, data) {
		
					if (err) { callback(err); return; }
		
					cloudwatchevents.deleteRule({
						Name: rule.Name  
					}, function(err, data) {
						
						if(err) { cb(err); return; }
		
						cb(null)
		
					});
		
				});
		
			});
		},

		function(cb) {
			
			getScheduledNotify(function(err, rule) {
				
				cloudwatchevents.removeTargets({
					Ids: [ '3' ],
					Rule: rule.Name
				}, function(err, data) {
		
					if (err) { callback(err); return; }
		
					cloudwatchevents.deleteRule({
						Name: rule.Name  
					}, function(err, data) {
						
						if(err) { cb(err); return; }
		
						cb(null)
		
					});
		
				});
		
			});
		}

	], cb)

}

function scheduleStop(cb) {

	reporter.report("Scheduling stop");
	
	getRemainingTime(function(err, data) {

		if(err) { cb(err); return; }

		reporter.report("Stopping in " + data.remainingMinutes + " minutes");

		async.parallel([

			function(cb) {

				var schedule = data.now.clone().utc().add(data.remainingMinutes, 'minute');
				var cron = `cron(${schedule.minute()} ${schedule.hour()} ${schedule.date()} ${schedule.month() + 1} ? *)`;

				cloudwatchevents.putRule({
					Name: cloudStopRulePrefix + "-" + data.instanceId,
					ScheduleExpression: cron,
					State: "ENABLED"
				}, function (err, ruleData) {
			
					if (err) { cb(err); return; }
		
					cloudwatchevents.putTargets({
						Rule: cloudStopRulePrefix + "-" + data.instanceId,
						Targets: [{
							Arn: `arn:aws:ssm:${config.AWSRegion}::document/AWS-RunPowerShellScript`,
							Id: "2",
							Input: JSON.stringify({
								commands: [ "Stop-Computer -Force" ]
							}),
							RoleArn: settings.cloudRIGRole,
							RunCommandParameters: {
								RunCommandTargets: [{
									Key: "InstanceIds",
									Values: [ data.instanceId ],
								}]
							}
						}]
						
					}, function(err, data) {
						
						if (err) { cb(err); return; }
						cb();
			
					});
			
				});


			},

			function(cb) {
				
				var schedule = data.now.clone().utc().add(data.remainingMinutes - 2, 'minute');
				var cron = `cron(${schedule.minute()} ${schedule.hour()} ${schedule.date()} ${schedule.month() + 1} ? *)`;
				
				cloudwatchevents.putRule({
					Name: cloudNotifyRulePrefix + "-" + data.instanceId,
					ScheduleExpression: cron,
					State: "ENABLED"
				}, function (err, ruleData) {
			
					if (err) { cb(err); return; }
		
					cloudwatchevents.putTargets({
						Rule: cloudNotifyRulePrefix + "-" + data.instanceId,
						Targets: [{
							Arn: `arn:aws:ssm:${config.AWSRegion}::document/AWS-RunPowerShellScript`,
							Id: "3",
							Input: JSON.stringify({
								commands: [ getPS1("Notify-Stop.ps1") ]
							}),
							RoleArn: settings.cloudRIGRole,
							RunCommandParameters: {
								RunCommandTargets: [{
									Key: "InstanceIds",
									Values: [ data.instanceId ],
								}]
							}
						}]
						
					}, function(err, data) {
						
						if (err) { cb(err); return; }
						cb();
			
					});
			
				});


			}

		], cb);
		
	});

}

// If no AMI, make it and run
// If instance exists, start it again
function start(cb) {

	var startFunctions = [];
	var state = {};
	var isCancelled;
	var cancelledError = "Sorry, Your price got outbid during provisioning";
	var rollback = new RollbackHandler();

	// This could be moved into a cloudwatchevent
	var _checkPriceFluctuation = (function() {

		var timer;

		function check() {
			
			getCurrentSpotPrice(function(err, data) {
				
				if(data.SpotPrice > config.AWSMaxPrice) {

					clearTimeout(timer);
					timer = null;
					isCancelled = true;

				} else {

					timer = setTimeout(check, 4000);

				}

			})

		}

		function start(cb) {
			check();
			cb();
		}

		function stop(cb) {
			clearTimeout(timer);
			timer = null;
			cb();
		}

		return {
			start: start,
			stop: stop
		}

	}())

	var _waitForSSM = function(cb) {

		reporter.report("Waiting for SSM");

		// BUG: There is a bug here with describeInstanceInformation returning empty when resuming a previous instance
		var checkCount = 0;

		function check() {

			if(isCancelled) { cb(cancelledError); return; }

			checkCount++;
			
			ssm.describeInstanceInformation({
				Filters: [{
					Key: "InstanceIds",
					Values: [state.instance.InstanceId]
				}]
			}, function(err, data) {
				
				if (err) { cb(err); return; }
				
				if(data.InstanceInformationList.length > 0 || checkCount > 30) {
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
			
			if(isCancelled) { cb(cancelledError); return; }

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
		}, function() { setTimeout(cb, 60000) } );
		
	};

	var _checkSpotPrice = function(cb) {

		getAvailabilityZoneInfo(function(err, data) {
			
			if(err) { cb(err); return; }

			state.availabilityZone = config.AWSAvailabilityZone;

			var zoneInfo = data.SpotPriceHistory[0];

			reporter.report("Spot price for your zone " + state.availabilityZone + " is $" + zoneInfo.SpotPrice + " / Max price: $" + config.AWSMaxPrice)

			if(parseFloat(zoneInfo.SpotPrice) >= parseFloat(config.AWSMaxPrice)) {
				cb("Your max price is too low right now. Either wait for the cost to go down, or raise your max price"); return;
			}
			
			cb();

		}, config.AWSAvailabilityZone)

	};

	var _getBestAvailabilityZone = function(cb) {

		getBestAvailabilityZone(function(err, bestAvailabilityZone) {
			
			if(err) { cb(err); return; }

			state.availabilityZone = bestAvailabilityZone.AvailabilityZone;
			
			reporter.report("It's " + state.availabilityZone + ": $" + bestAvailabilityZone.SpotPrice + " / Max price: $" + config.AWSMaxPrice)

			if(parseFloat(bestAvailabilityZone.SpotPrice) >= parseFloat(config.AWSMaxPrice)) {
				cb("Your max price is too low right now. Either wait for the cost to go down, or raise your max price"); return;
			}
			cb();

		});
	};

	var _createCloudWatchEvent = function(cb) {

		if(isCancelled) { cb(cancelledError); return; }

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

		getEBSVolumes(function(err, volumes) {

			if (err) { cb(err); return; }
			
			volumes = volumes.filter(function(v) {
				return v.AvailabilityZone === state.availabilityZone
			});

			// Exists
			if(volumes[0]) {

				reporter.report("Found EBS Volume")

				state.volumeId = volumes[0].VolumeId;
				
				ec2.attachVolume({
					Device: "xvdb", 
					InstanceId: state.instance.InstanceId,
					VolumeId: state.volumeId
				}, function(err, data) {
				
					if (err) { cb(err); return; }
					cb();
				
				});

			}

			else {

				reporter.report("Did not find EBS Volume")

				cb();
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

				if(isCancelled) { cb(cancelledError); return; }

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

				_checkSpotPrice,

				_checkPriceFluctuation.start,
				
				_request,

				_tag,

				_waitForInstanceOk,

				_waitForSSM,

				_attachEBSVolume,

				_reboot,
	
				_createCloudWatchEvent,

				_checkPriceFluctuation.stop

			]

		} else {

			reporter.report("Making your cloudRIG! This happens once and may take a while.");
			
			state.fromBase = true;

			startFunctions = [
	
				_getBaseAMI,
				
				_checkSpotPrice,

				_checkPriceFluctuation.start,

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
/*
				function(cb) {
					reporter.report("Binding Steam Library");
					sendMessage(getPS1("Bind-Steam-Library.ps1"), cb);
				},
*/
				_reboot,
	
				_createCloudWatchEvent,

				_checkPriceFluctuation.stop
	
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

function sendMessage(commands, cb) {

	commands = !Array.isArray(commands) ? [commands] : commands;

	getActiveInstances(function(err, instances) {
		
		if(err) { cb(err); return; }

		var instanceId = instances[0].InstanceId
		
		var params = {
			DocumentName: "AWS-RunPowerShellScript",
			InstanceIds: [ instanceId ],
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

	validateRequiredConfig: validateRequiredConfig,

	getState: getState,

	setConfig: function(_config) {
		config = _config;
	},

	init: function(reporterMethod) {

		setReporter(reporterMethod);

		if (!fs.existsSync(cloudrigDir)) {
			fs.mkdirSync(cloudrigDir);
		}

		// TODO: Make this safer for already existing config file
		// fs.existsSync
		try {
			getConfigFile();
		} catch(ex) {
			reporter.report("[!] Config file missing/broken - copying from config.sample.json");
			setConfigFile(JSON.parse(fs.readFileSync(__dirname + "/config.sample.json")));
		}

	},

	setup: function(cb) {
		
		credentials = new AWS.SharedIniFileCredentials({
			filename: config.AWSCredentialsFile,
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
			getCloudRIGRole,
			getSecurityGroup,
			getIPAddress,
			getLambdaFunction,
			getLambdaSaveFunction,
			getKeyPair,
			getActiveInstances
		], function(err, results) {

			if(err) { cb(err); return; }

			var cloudRIGRole 		= results[0];
			var securityGroup 		= results[1];
			var ipAddress 			= results[2];
			var lambda 				= results[3];
			var lambdaSave			= results[4];
			var keyPair				= results[5];
			var activeInstances		= results[6];

			var questions = [];

			if(!keyPair) {
				questions.push({
					q: "Shall I make a Key Pair called 'cloudrig'?",
					m: function(cb) {

						createKeyPair(function(err, data) {

							if(err) { cb(err); return; }

							userDataFileWriter(securityKeyPairName, data.KeyMaterial);
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
					q: "Shall I make a role and instance profile called '" + cloudRIGRoleName + "' for handling the AWS services? NOTE: This is a very privileged role, so it is strongly recommended that you use a separate AWS account solely for cloudRIG.",
					m: createCloudrigRole.bind(this)
				});
			} else {
				settings.cloudRigInstanceProfile = cloudRIGRole.InstanceProfile.Arn;
				settings.cloudRIGRole = cloudRIGRole.Role.Arn;

				if(!lambdaSave) {
					questions.push({
						q: "Shall I make a make a lambda function called '" + lambdaSaveFunctionName + "' for autosaving cloudRIG?",
						m: createSaveLambdaFunction.bind(this)
					});
				} else {
					settings.lambdaSave = lambdaSave;

					if(!lambda) {
						questions.push({
							q: "Shall I make a make a lambda function called '" + lambdaFunctionName + "' for cloudRIG state watching?",
							m: createLambdaFunction.bind(this)
						});
					} else {
						settings.lambda = lambda;
					}

				}
				
			}

			if(!securityGroup) {
				questions.push({
					q: "Shall I make a cloudRIG security group for you?",
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

			if(questions.length === 0 && activeInstances.length > 0) {

				reporter.report("Checking instance");

				getCloudWatchEvent(function(err, rules) {
					if(err) { cb(err); return; }
					
					if(!rules) {

						reporter.report("No shut down rule, so making one...")

						createCloudWatchEvent(activeInstances[0].InstanceId, function(err) {
							if(err) { cb(err); return; }

							cb(null, []);
						})

					} else {

						cb(null, []);

					}

				});

			} else {

				cb(null, questions);

			}

		});

	},
	
	getActive: getActiveInstances,

	getPending: getPendingInstances,

	getStoppingInstances: getStoppingInstances,

	getPublicDNS: getPublicDNS,

	start: start,

	stop: stop,

	getConfigFile: getConfigFile,

	getCredentials: getCredentials,

	saveCredentialsFile: saveCredentialsFile,

	getRemainingTime: getRemainingTime,

	getScheduledStop: getScheduledStop,

	cancelScheduledStop: cancelScheduledStop,

	scheduleStop: scheduleStop,

	sendMessage: sendMessage,

	setReporter: setReporter,

	setConfigFile: setConfigFile,

	createEBSVolume: createEBSVolume,
	
	deleteEBSVolume: deleteEBSVolume,
	
	_sendAdHoc: sendAdHoc,

	_getInstanceProfiles: getInstanceProfiles,

	_getSettings: getSettings,

	_deleteInstanceProfile: deleteInstanceProfile,
	
	_createSecurityGroup: createSecurityGroup

};