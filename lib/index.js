"use strict";

var AWS = require("aws-sdk");
var async = require("async");
var fs = require("fs");
var getIP = require("external-ip");
var JSZip = require("jszip");
var tmp = require("tmp");
var moment = require("moment");
var homedir = require("os").homedir();

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
var cloudwatchlogs;
var reporter;
var securityKeyPairName = "cloudrig.pem";
var cloudRIGRoleName = "cloudrig-role";
// Used for instance profile name too
var cloudRIGInstanceProfileRoleName = "cloudrig-instance-profile-role";
var lambdaFunctionName = "cloudrig-lambda";
var lambdaSaveFunctionName = "cloudrig-save";
var cloudWatchRulePrefix = "cloudrig-watch";
var cloudWatchSavePrefix = "cloudrig-save";
var cloudStopRulePrefix = "cloudrig-stop";
var cloudNotifyRulePrefix = "cloudrig-notify";
var cloudrigDir = homedir + "/.cloudrig/";
var updateFlagFile = cloudrigDir + ".updateflag";
var standardFilter = [
	{
		Name: "tag:cloudrig",
		Values: ["true"]
	}
];
var zonesArr = {
	"eu-central-1": ["a", "b"],
	"eu-west-1": ["a", "b", "c"],
	"us-east-1": ["a", "b", "c", "d", "e"],
	"us-west-1": ["a", "b", "c"],
	"us-west-2": ["a", "b", "c"],
	"ap-southeast-1": ["a", "b"],
	"ap-northeast-1": ["a", "b", "c"],
	"ap-southeast-2": ["a", "b"],
	"sa-east-1": ["a", "b"]
};

function lambdaFunction() {
	return `var AWS = require('aws-sdk');

	exports.handler = (event, context, callback) => {
	
	console.log("Triggered");
	console.log(event);
	console.log(context);
	
	var ec2 = new AWS.EC2();
	var cloudwatchevents = new AWS.CloudWatchEvents();
	var lambda = new AWS.Lambda();
	var ImageId;
	var RuleArn;
	
	function waterfall(arr, cb) {
		function process(arr, cb, err, data) {
			if(err) { cb(err); return; }
			if(arr.length === 0) { cb(null, data); return; }
			var forwardArgs = [process.bind(null, arr, cb)]
			if(data) { forwardArgs.unshift(data) }
			arr.shift().apply(null, forwardArgs)
		}
		process(arr, cb)
	}
		function newImage() {
			var instanceId = event.detail["instance-id"];
			waterfall([
				function (cb) {
					console.log("Create new AMI for instance with id " + instanceId);
					ec2.createImage({
						InstanceId: instanceId,
						Name: 'cloudrig-' + new Date().getTime(),
						NoReboot: true,
						BlockDeviceMappings: [{
							DeviceName: "xvdb",
							NoDevice: ""
						}]
					}, cb)
				},
				function (data, cb) {
					console.log("Creating tags for " + data.ImageId);
					ImageId=data.ImageId;
					ec2.createTags({
						Resources: [data.ImageId],
						Tags: [{
							Key: "cloudrig",
							Value: "true"
						}]
					}, cb)
				},
				function (data, cb) {
					console.log("Creating Save CloudWatch")
					cloudwatchevents.putRule({
						Name: "${lambdaSaveFunctionName}-" + ImageId,
						ScheduleExpression: "rate(1 minute)",
						State: "ENABLED"
					}, cb)
				},
				function (data, cb) {
					RuleArn=data.RuleArn;
					console.log("Creating Save CloudWatch target");
					cloudwatchevents.putTargets({
						Rule: "${lambdaSaveFunctionName}-" + ImageId,
						Targets: [{
							Arn: "${settings.lambdaSave.FunctionArn}",
							Id: '4'
						}]
					}, cb)
				},
				function (data, cb) {
					console.log(RuleArn);
					console.log("Give Save CloudWatch lambda permission");
					lambda.addPermission({
						Action: "lambda:InvokeFunction",
						FunctionName: "${lambdaSaveFunctionName}",
						Principal: "events.amazonaws.com",
						SourceArn: RuleArn,
						StatementId: "Statement-" + ImageId

					}, cb)
				},
				function (data, cb) {
					console.log("Finding spot instance request id");
					ec2.describeInstances({
						InstanceIds: [instanceId]
					}, cb)
				},
				function (data, cb) {
					var spotInstanceRequestId = data.Reservations[0].Instances[0].SpotInstanceRequestId
					console.log("Deleting spot request");
					ec2.cancelSpotInstanceRequests({
						SpotInstanceRequestIds: [spotInstanceRequestId]
					}, cb)
				},
				function (data, cb) {
					console.log("Deleting spot instance " + instanceId);
					ec2.terminateInstances({
						InstanceIds: [instanceId]
					}, cb)
				},
				function (data, cb) {
					console.log("Removing lambda cloudwatch permission");
					lambda.removePermission({
						FunctionName: "${lambdaFunctionName}",
						StatementId: "Statement-" + instanceId
					}, cb)
				},
				function (data, cb) {
					console.log("Deleting cloud watch targets");
					cloudwatchevents.removeTargets({
						Ids: ['1'],
						Rule: "${cloudWatchRulePrefix}-" + instanceId
					}, cb)
				},
				function (data, cb) {
					console.log("Deleting cloud watch rule");
					cloudwatchevents.deleteRule({
						Name: "${cloudWatchRulePrefix}-" + instanceId
					}, cb)
				},
				function (data, cb) {
					cloudwatchevents.listRules({
						NamePrefix: "${cloudStopRulePrefix}-" + instanceId
					}, cb)
				},
				function (data, cb) {
					if (!!data.Rules[0]) {
						console.log("Deleting cloud stop targets");
						cloudwatchevents.removeTargets({
							Ids: ['2'],
							Rule: "${cloudStopRulePrefix}-" + instanceId
						}, cb)
					}
					else cb(null);
				},
				function (data, cb) {
					console.log("Deleting cloud stop rule");
					cloudwatchevents.deleteRule({
						Name: "${cloudStopRulePrefix}-" + instanceId
					}, cb)
				},
				function (data, cb) {
					console.log("Deleting cloud notify targets");
					cloudwatchevents.removeTargets({
						Ids: ['3'],
						Rule: "${cloudNotifyRulePrefix}-" + instanceId
					}, cb)
				},
				function (data, cb) {
					console.log("Deleting cloud notify rule");
					cloudwatchevents.deleteRule({
						Name: "${cloudNotifyRulePrefix}-" + instanceId
					}, cb)
				}
			], function (err, data) {
				if (err) { console.log(err); callback(err); }
				callback();
			});
		}
		waterfall([
			function (cb) {
				ec2.describeImages({
					Filters: [{
						Name: 'tag:cloudrig',
						Values: ['true']
					}]
				}, cb)
			},
			function (data, cb) {
				if (data.Images.length > 0) {
					console.log("Deregister previous image");
					ec2.deregisterImage({
						ImageId: data.Images[0].ImageId
					}, function(err, newData){
						if(err) cb(err);
						else cb(null, data);
					})
				}
				else cb(null, data);
			},
			function(data, cb){
				if(data.Images.length > 0 && data.Images[0].BlockDeviceMappings.length > 0)
				{
					console.log("Delete previous snapshot");
					ec2.deleteSnapshot({SnapshotId:data.Images[0].BlockDeviceMappings[0].Ebs.SnapshotId},cb);
				}
				else cb(null);
			}
		],
			function (err, data) {
				if (err) { console.log(err); callback(err); }
				newImage();
			});
	}`;
}

var lambdaSaveFunction = function () {
	return `var AWS = require('aws-sdk');

	exports.handler = (event, context, callback) => {

		console.log("Triggered");
		console.log(event);
		console.log(context);

		var ec2 = new AWS.EC2();
		var cloudwatchevents = new AWS.CloudWatchEvents();
		var lambda = new AWS.Lambda();

		function waterfall(arr, cb) {
			function process(arr, cb, err, data) {
				if (err) { cb(err); return; }
				if (arr.length === 0) { cb(null, data); return; }
				var forwardArgs = [process.bind(null, arr, cb)]
				if (data) { forwardArgs.unshift(data) }
				arr.shift().apply(null, forwardArgs)
			}
			process(arr, cb)
		}

		function series(arr, cb) {
			function process(arr, cb, err) {
				if(err) { cb(err); return; }
				if(arr.length === 0) { cb(null); return; }
				arr.shift().call(null, process.bind(null, arr, cb))
			}
			process(arr, cb)
		}

		waterfall([
			
			function (cb) {
				ec2.describeImages({
					Owners: ['self'],
					Filters: [{
						Name: 'tag:cloudrig',
						Values: ['true']
					}]
				}, cb)
			},
				
			function (data, cb) {
				
				if(data.Images.length === 0) {
					console.log("No image saved. Returning.");
					cb();
				} else {
					console.log("Image saved");
					series([
						function(cb) {
							console.log("Removing cloudwatchevents targets");
							cloudwatchevents.removeTargets({
								Ids: ['4'],
								Rule: "${cloudWatchSavePrefix}-" + data.Images[0].ImageId
							}, cb)
						},
						function(cb) {
							console.log("Deleting cloudwatchevents rule");
							cloudwatchevents.deleteRule({
								Name: "${cloudWatchSavePrefix}-" + data.Images[0].ImageId
							}, cb)
						},
						function(cb) {
							console.log("Removing lambda permission");
							lambda.removePermission({
								FunctionName: "${lambdaSaveFunctionName}",
								StatementId: "Statement-" + data.Images[0].ImageId
							}, cb)
						}
					], cb)
					
				}
			}
		], function(err) {
				
			if (err) { console.log(err); callback(err); return; }
			console.log("Done");
			callback();
				
		});
		
	}`;
};

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
	if (fs.existsSync(config.AWSCredentialsFile)) {
		return fs.readFileSync(config.AWSCredentialsFile);
	}
	return "";
}

function saveCredentialsFile(data) {
	fs.writeFileSync(
		config.AWSCredentialsFile + "-backup-" + +new Date(),
		getCredentials()
	);
	fs.writeFileSync(config.AWSCredentialsFile, data);
}

function setReporter(reporterMethod) {
	reporter = {
		report: function () {
			var message = Array.prototype.slice.call(arguments).join("\t");
			reporterMethod.call(null, message);
		}
	};
}

var RollbackHandler = function () {
	var steps = [];
	var self = this;

	this.clear = function () {
		steps = [];
	};

	this.add = function (step) {
		steps.push(step);
	};

	this.process = function (originalError, cb) {
		reporter.report("Something went wrong, so rolling back...");

		async.series(steps, function (err, result) {
			if (err) {
				reporter.report(
					"Error with rollback, please log into AWS console and check"
				);
			} else {
				reporter.report("Successfully rolled back");
			}

			self.clear();

			cb(originalError);
		});
	};
};

// #region Get

function getPS1(script) {
	return fs.readFileSync(__dirname + "/ps1/" + script).toString();
}

function getLambdaFunction(cb) {
	lambda.listFunctions({}, function (err, data) {
		if (err) {
			cb(err);
			return;
		}

		cb(
			null,
			data.Functions.find(function (func) {
				return func.FunctionName === lambdaFunctionName;
			})
		);
	});
}

function getLambdaSaveFunction(cb) {
	lambda.listFunctions({}, function (err, data) {
		if (err) {
			cb(err);
			return;
		}

		cb(
			null,
			data.Functions.find(function (func) {
				return func.FunctionName === lambdaSaveFunctionName;
			})
		);
	});
}

function getInstanceProfiles(cb) {
	iam.listInstanceProfiles({}, function (err, data) {
		if (err) {
			cb(err);
			return;
		}

		cb(null, data);
	});
}

function getPendingAMI(cb) {
	cloudwatchevents.listRules(
		{
			NamePrefix: cloudWatchSavePrefix + "-"
		},
		function (err, data) {
			if (err) {
				cb(err);
				return;
			}
			cb(null, data.Rules[0]);
		}
	);
}

function getAMI(cb) {
	reporter.report("Finding AMI");

	ec2.describeImages(
		{
			Owners: ["self"],
			Filters: standardFilter
		},
		function (err, data) {
			if (err) {
				cb(err);
				return;
			}

			cb(null, data.Images[0]);
		}
	);
}

function getEBSVolumes(cb) {
	ec2.describeVolumes(
		{
			Filters: standardFilter
		},
		function (err, data) {
			if (err) {
				cb(err);
				return;
			}
			cb(null, data.Volumes);
		}
	);
}

function getCloudRIGRole(cb) {
	reporter.report("Finding cloudRIG Role");

	var ret;

	iam.listRoles({}, function (err, data) {
		if (err) {
			cb(err);
			return;
		}

		data.Roles.forEach(function (role, i) {
			if (role.RoleName == cloudRIGRoleName) {
				ret = role;
			}
		});

		cb(null, ret);
	});
}

function getCloudRIGInstanceProfileRole(cb) {
	reporter.report("Finding cloudRIG Instance Profile Role");

	var ret;

	iam.listRoles({}, function (err, data) {
		if (err) {
			cb(err);
			return;
		}

		data.Roles.forEach(function (role, i) {
			if (role.RoleName == cloudRIGInstanceProfileRoleName) {
				ret = role;
			}
		});

		cb(null, ret);
	});
}

function getCloudRIGInstanceProfile(cb) {
	getInstanceProfiles(function (err, profiles) {
		if (err) {
			cb(err);
			return;
		}

		cb(
			null,
			profiles.InstanceProfiles.find(function (profile) {
				return (
					profile.InstanceProfileName ==
					cloudRIGInstanceProfileRoleName
				);
			})
		);
	});
}

function getSecurityGroup(cb) {
	reporter.report("Finding Security Group");

	ec2.describeSecurityGroups(
		{
			Filters: standardFilter
		},
		function (err, data) {
			if (err) {
				cb(err);
			} else {
				cb(null, data.SecurityGroups[0]);
			}
		}
	);
}

function getKeyPair(cb) {
	reporter.report("Finding Key Pair");

	ec2.describeKeyPairs(
		{
			KeyNames: ["cloudrig"]
		},
		function (err, data) {
			// Error if there are no keys
			// TODO: Warn if there's more than 1
			if (err) {
				cb(null, null);
			} else {
				cb(null, data.KeyPairs[0]);
			}
		}
	);
}

function getActiveInstances(cb) {
	ec2.describeInstances(
		{
			Filters: standardFilter.concat([
				{
					Name: "instance-state-name",
					Values: ["running"]
				}
			])
		},
		function (err, data) {
			if (err) {
				cb(err);
				return;
			}

			cb(
				null,
				data.Reservations[0] && data.Reservations[0].Instances
					? data.Reservations[0].Instances
					: []
			);
		}
	);
}

// TODO: Fix ordering of arguments consistency
function getAvailabilityZoneInfo(cb, availabilityZone) {
	ec2.describeSpotPriceHistory(
		{
			AvailabilityZone: availabilityZone,
			MaxResults: 1,
			InstanceTypes: [config.AWSInstanceType],
			ProductDescriptions: ["Windows"]
		},
		cb
	);
}

function getCurrentSpotPrice(cb) {
	getAvailabilityZoneInfo(function (err, data) {
		if (err) {
			cb(err);
			return;
		}

		cb(null, data.SpotPriceHistory[0]);
	}, config.AWSAvailabilityZone);
}

function getBestAvailabilityZone(cb) {
	reporter.report("Getting best Availability Zone");

	getAvailabilityZones(function (err, data) {
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
				config.AWSInstanceType
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
			Values: data.AvailabilityZones.filter(function (zone) {
				return zone.State === "available";
			}).map(function (zone) {
				return zone.ZoneName;
			})
		};

		async.parallel(
			data.AvailabilityZones.filter(function (zone) {
				return zone.State === "available";
			}).map(function (zone) {
				return function (availabilityZone, cb) {
					ec2.describeSpotPriceHistory(
						{
							AvailabilityZone: availabilityZone,
							MaxResults: 1,
							InstanceTypes: [config.AWSInstanceType],
							ProductDescriptions: ["Windows"]
						},
						cb
					);
				}.bind(null, zone.ZoneName);
			}),
			function (err, results) {
				var ret = Array.prototype.concat
					.apply(
						[],
						results.map(function (result) {
							return result.SpotPriceHistory;
						})
					)
					.sort(function (a, b) {
						return (
							parseFloat(a.SpotPrice) - parseFloat(b.SpotPrice)
						);
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

function getStoppedInstances(cb) {
	ec2.describeInstances(
		{
			Filters: standardFilter.concat([
				{
					Name: "instance-state-name",
					Values: ["stopped"]
				}
			])
		},
		function (err, data) {
			if (err) {
				cb(err);
			} else {
				cb(
					null,
					data.Reservations[0] ? data.Reservations[0].Instances : []
				);
			}
		}
	);
}

function getPendingInstances(cb) {
	ec2.describeInstances(
		{
			Filters: standardFilter.concat([
				{
					Name: "instance-state-name",
					Values: ["pending"]
				}
			])
		},
		function (err, data) {
			if (err) {
				cb(err);
			} else {
				cb(
					null,
					data.Reservations[0] ? data.Reservations[0].Instances : []
				);
			}
		}
	);
}

function getStoppingInstances(cb) {
	ec2.describeInstances(
		{
			Filters: standardFilter.concat([
				{
					Name: "instance-state-name",
					Values: ["stopping"]
				}
			])
		},
		function (err, data) {
			if (err) {
				cb(err);
			} else {
				cb(
					null,
					data.Reservations[0] ? data.Reservations[0].Instances : []
				);
			}
		}
	);
}

function getPublicDNS(cb) {
	getActiveInstances(function (err, instances) {
		if (err) {
			cb(err);
			return;
		}
		cb(null, instances[0].PublicDnsName);
	});
}

function getBaseAMI(cb) {
	reporter.report("Finding Parsec AMI");

	ec2.describeImages(
		{
			Filters: [
				{
					Name: "name",
					Values: [config.AWSInstanceType === "g2.2xlarge" ? "parsec-g2-*" : "parsec-g3-*"]
				}
			]
		},
		function (err, data) {
			if (err) {
				cb(err);
				return;
			}
			cb(null, data.Images[0]);
		}
	);
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
	var tags = [
		{
			Key: "cloudrig",
			Value: "true"
		}
	];

	if (additionalTags) {
		tags = tags.concat(additionalTags);
	}

	ec2.createTags(
		{
			Resources: [resourceId],
			Tags: tags
		},
		function (err, data) {
			if (err) {
				cb(err);
				return;
			}

			cb(null, data);
		}
	);
}

function createSecurityGroup(cb) {
	reporter.report("Creating security group");

	ec2.createSecurityGroup(
		{
			Description: "cloudrig",
			GroupName: "cloudrig"
		},
		function (err, securityGroupData) {
			if (err) {
				cb(err);
				return;
			}

			getIPAddress(function (err, ip, ipis6) {
				if (err) {
					cb(err);
					return;
				}

				reporter.report("Tagging Security Group");
				createTags(securityGroupData.GroupId, null, function (err) {
					if (err) {
						cb(err);
						return;
					}

					addIPToSecurityGroup(
						securityGroupData.GroupId,
						ip,
						ipis6,
						cb
					);
				});
			});
		}
	);
}

function createEBSVolume(availabilityZone, size, cb) {
	reporter.report("Creating EBS Volume");

	var params = {
		AvailabilityZone: availabilityZone,
		Size: size,
		VolumeType: "gp2"
	};

	ec2.createVolume(params, function (err, data) {
		if (err) {
			cb(err);
			return;
		}

		ec2.waitFor(
			"volumeAvailable",
			{
				VolumeIds: [data.VolumeId]
			},
			function (err) {
				if (err) {
					cb(err);
					return;
				}

				createTags(data.VolumeId, null, function (err) {
					if (err) {
						cb(err);
						return;
					}

					cb(null, data.VolumeId);
				});
			}
		);
	});
}

function deleteEBSVolume(volumeId, cb) {
	reporter.report("Deleting EBS Volume " + volumeId);

	ec2.deleteVolume(
		{
			VolumeId: volumeId
		},
		function (err, data) {
			if (err) {
				cb(err);
				return;
			}

			cb();
		}
	);

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

function expandEBSVolume(volumeId, newSize, cb) {
	reporter.report("Expanding EBS Volume");
	async.waterfall(
		[
			function (callback) {
				ec2.modifyVolume(
					{
						VolumeId: volumeId,
						Size: newSize
					},
					callback
				);
			},
			function checkModify(data, callback) {
				ec2.describeVolumesModifications(
					{
						VolumeIds: [data.VolumeId]
					},
					function (err, data) {
						if (data && data.VolumesModifications) {
							var modify = data.VolumesModifications[0];
							if (
								modify.ModificationState != "modifying" &&
								modify.ModificationState != "failed"
							) {
								callback(null, data);
							} else checkModify(data, callback);
						} else callback(err, data);
					}
				);
			} /*,
			function(data, callback){
				sendMessage(getPS1("Resize-Drive.ps1"), callback);
			}*/
		],
		function (err, data) {
			if (err) {
				cb(err);
				return;
			}
			cb();
		}
	);
}

function transferEBSVolume(volume, cb) {
	reporter.report("Transfer EBS Volume " + volume.VolumeId);
	var IOPScoef = 50;
	var minVolumeSize = 4;
	var minIOPS = 100;
	var maxIOPS = 32000;
	var newVolumeSize =
		volume.Size > minVolumeSize ? volume.Size : minVolumeSize;
	var modifyVolumeParams = {
		VolumeId: volume.VolumeId,
		Iops:
			IOPScoef * newVolumeSize > maxIOPS
				? maxIOPS
				: IOPScoef * newVolumeSize < minIOPS
					? minIOPS
					: IOPScoef * newVolumeSize,
		Size: newVolumeSize,
		VolumeType: "io1"
	};
	async.waterfall(
		[
			function (callback) {
				ec2.modifyVolume(modifyVolumeParams, callback);
			},
			function checkModify(data, callback) {
				ec2.describeVolumesModifications(
					{
						VolumeIds: [data.VolumeId]
					},
					function (err, data) {
						if (err) callback(err, null);
						if (data && data.VolumesModifications) {
							var modify = data.VolumesModifications[0];
							if (
								modify.ModificationState != "modifying" &&
								modify.ModificationState != "failed"
							) {
								callback(null, data);
							} else
								setTimeout(function () {
									checkModify(data, callback);
								}, 5000);
						} else callback(err, data);
					}
				);
			},
			function (data, callback) {
				ec2.createSnapshot(
					{
						VolumeId: volume.VolumeId
					},
					callback
				);
			},
			function checkSnapshotState(data, callback) {
				ec2.describeSnapshots(
					{
						Filters: [
							{
								Name: "snapshot-id",
								Values: [data.SnapshotId]
							}
						],
						SnapshotIds: [data.SnapshotId]
					},
					function (err, newData) {
						if (err) callback(err, null);
						if (newData && newData.Snapshots) {
							if (newData.Snapshots[0].State === "completed") {
								callback(null, newData);
							} else
								setTimeout(function () {
									checkSnapshotState(data, callback);
								}, 5000);
						} else callback(err, data);
					}
				);
			},
			function (data, callback) {
				var createNewVolumeParams = {
					AvailabilityZone: config.AWSAvailabilityZone,
					SnapshotId: data.Snapshots[0].SnapshotId,
					VolumeType: "gp2",
					Size: data.Snapshots[0].VolumeSize
				};
				ec2.createVolume(createNewVolumeParams, callback);
			},
			function (data, callback) {
				ec2.waitFor(
					"volumeAvailable",
					{
						VolumeIds: [data.VolumeId]
					},
					callback
				);
			},
			function (data, callback) {
				createTags(data.Volumes[0].VolumeId, null, callback);
			},
			function (data, callback) {
				ec2.deleteVolume(
					{
						VolumeId: volume.VolumeId
					},
					callback
				);
			}
		],
		function (err, result) {
			if (err) {
				cb(err);
				return;
			}
			cb();
		}
	);
}

function deleteSnapshotByVolumeId(volumeId, cb) {
	reporter.report("Deleting snapshot by volume id " + volumeId);

	ec2.describeSnapshots(
		{
			Filters: [
				{
					Name: "volume-id",
					Values: [volumeId]
				}
			]
		},
		function (err, data) {
			if (err) {
				cb(err);
				return;
			}

			ec2.deleteSnapshot(
				{
					SnapshotId: data.Snapshots[0].SnapshotId
				},
				cb
			);
		}
	);
}

function addIPToSecurityGroup(securityGroupId, ip, ipis6, cb) {
	reporter.report("Adding IP Address to Security Group");

	var params = {
		FromPort: -1,
		ToPort: -1,
		IpProtocol: "-1"
	};

	if (!ipis6) {
		params.IpRanges = [
			{
				CidrIp: ip + "/32"
			}
		];
	} else {
		params.Ipv6Ranges = [
			{
				CidrIpv6: ip + "/128"
			}
		];
	}

	ec2.authorizeSecurityGroupIngress(
		{
			GroupId: securityGroupId,
			IpPermissions: [params]
		},
		function (err, data) {
			if (err) {
				cb(err);
				return;
			}

			cb(null);
		}
	);
}

function deleteRole(cb) {
	reporter.report("Deleting role " + cloudRIGRoleName);

	async.series(
		[
			// For legacy reasons. The role used to have attached policies
			function (cb) {
				iam.listAttachedRolePolicies(
					{
						RoleName: cloudRIGRoleName
					},
					function (err, data) {
						if (err) {
							cb(err);
							return;
						}

						if (data.AttachedPolicies.length > 0) {
							async.parallel(
								data.AttachedPolicies.map(function (policy) {
									return iam.detachRolePolicy.bind(iam, {
										PolicyArn: policy.PolicyArn,
										RoleName: cloudRIGRoleName
									});
								}),
								cb
							);
						} else {
							cb();
						}
					}
				);
			},

			// Inline policies
			function (cb) {
				iam.listRolePolicies(
					{
						RoleName: cloudRIGRoleName
					},
					function (err, data) {
						if (err) {
							cb(err);
							return;
						}

						if (data.PolicyNames.length > 0) {
							async.parallel(
								data.PolicyNames.map(function (policy) {
									return iam.deleteRolePolicy.bind(iam, {
										PolicyName: policy,
										RoleName: cloudRIGRoleName
									});
								}),
								cb
							);
						} else {
							cb();
						}
					}
				);
			},

			function (cb) {
				iam.deleteRole(
					{
						RoleName: cloudRIGRoleName
					},
					cb
				);
			}
		],
		cb
	);
}

function deleteInstanceProfileRole(cb) {
	async.series(
		[
			function (cb) {
				reporter.report("Detaching policies");

				iam.listAttachedRolePolicies(
					{
						RoleName: cloudRIGInstanceProfileRoleName
					},
					function (err, data) {
						if (err) {
							cb(err);
							return;
						}

						async.parallel(
							data.AttachedPolicies.map(function (policy) {
								return iam.detachRolePolicy.bind(iam, {
									PolicyArn: policy.PolicyArn,
									RoleName: cloudRIGInstanceProfileRoleName
								});
							}),
							cb
						);
					}
				);
			},

			function (cb) {
				reporter.report("Deleting inline policies");

				iam.listRolePolicies(
					{
						RoleName: cloudRIGInstanceProfileRoleName
					},
					function (err, data) {
						if (err) {
							cb(err);
							return;
						}

						if (data.PolicyNames.length > 0) {
							async.parallel(
								data.PolicyNames.map(function (policy) {
									return iam.deleteRolePolicy.bind(iam, {
										PolicyName: policy,
										RoleName: cloudRIGInstanceProfileRoleName
									});
								}),
								cb
							);
						} else {
							cb();
						}
					}
				);
			},

			function (cb) {
				reporter.report("Deleting role");

				iam.deleteRole(
					{
						RoleName: cloudRIGInstanceProfileRoleName
					},
					cb
				);
			}
		],
		cb
	);
}

function removeRoleFromInstanceProfile(cb) {
	reporter.report("Removing Role From Instance Profile");

	getCloudRIGInstanceProfile(function (err, profile) {
		if (err) {
			cb(err);
			return;
		}

		// Should only be one
		if (profile && profile.Roles.length > 0) {
			iam.removeRoleFromInstanceProfile(
				{
					InstanceProfileName: cloudRIGInstanceProfileRoleName,
					RoleName: cloudRIGInstanceProfileRoleName
				},
				function (err, data) {
					if (err) {
						cb(err);
						return;
					}

					cb();
				}
			);
		} else {
			cb();
		}
	});
}

function deleteInstanceProfile(cb) {
	reporter.report("Deleting instance profile");

	removeRoleFromInstanceProfile(function (err) {
		if (err) {
			cb(err);
			return;
		}
		deleteInstanceProfileByName(cloudRIGInstanceProfileRoleName, function (
			err
		) {
			if (err) {
				cb(err);
				return;
			}
			cb();
		});
	});
}

function deleteAllRolesAndInstanceProfile(cb) {
	reporter.report("Deleting all roles and instance profile");

	async.series(
		[deleteInstanceProfile, deleteInstanceProfileRole, deleteRole],
		function (err) {
			if (err) {
				cb(err);
				return;
			}
			reporter.report("Waiting for changes to propagate");
			setTimeout(cb, 10000);
		}
	);
}

function deleteLambdaSave(cb) {
	lambda.deleteFunction(
		{
			FunctionName: lambdaSaveFunctionName
		},
		cb
	);
}

function deleteLambda(cb) {
	lambda.deleteFunction(
		{
			FunctionName: lambdaFunctionName
		},
		cb
	);
}

function createCloudrigInstanceProfileRole(cb) {
	reporter.report(
		`Creating cloudRIG Instance Profile role '${cloudRIGInstanceProfileRoleName}'`
	);

	async.series(
		[
			function (cb) {
				var policy = `{
				"Version": "2012-10-17",
				"Statement": {
					"Effect": "Allow",
					"Principal": {
						"Service": "ec2.amazonaws.com"
					},
					"Action": "sts:AssumeRole"
				}
			}`;

				iam.createRole(
					{
						AssumeRolePolicyDocument: policy,
						Path: "/",
						RoleName: cloudRIGInstanceProfileRoleName
					},
					cb
				);
			},
			function (cb) {
				var policy =
					"arn:aws:iam::aws:policy/service-role/AmazonEC2RoleforSSM";

				reporter.report(
					`Attaching the policy '${policy}' to ${cloudRIGInstanceProfileRoleName}`
				);

				iam.attachRolePolicy(
					{
						PolicyArn: policy,
						RoleName: cloudRIGInstanceProfileRoleName
					},
					cb
				);
			},

			function (cb) {
				var policy = `{
						"Version": "2012-10-17",
						"Statement": [
							{
								"Effect": "Allow",
								"Action": "ec2:DeleteTags",
								"Resource": "arn:aws:ec2:*:*:instance/*",
								"Condition": {
									"StringEquals": {
										"ec2:ResourceTag/cloudrig": "true"
									}
								}
							}
						]
					}`;

				reporter.report(
					`Attaching the delete tags policy to ${cloudRIGInstanceProfileRoleName}`
				);

				iam.putRolePolicy(
					{
						PolicyDocument: policy,
						PolicyName: cloudRIGRoleName + "delete-tags-policy",
						RoleName: cloudRIGInstanceProfileRoleName
					},
					cb
				);
			}
		],
		cb
	);
}

function createCloudrigInstanceProfile(cb) {
	async.series(
		[
			function (cb) {
				reporter.report(
					`Creating instance profile '${cloudRIGInstanceProfileRoleName}'`
				);

				iam.createInstanceProfile(
					{
						InstanceProfileName: cloudRIGInstanceProfileRoleName
					},
					cb
				);
			},

			function (cb) {
				reporter.report(
					`Adding role '${cloudRIGInstanceProfileRoleName}' to instance profile '${cloudRIGInstanceProfileRoleName}'`
				);

				iam.addRoleToInstanceProfile(
					{
						InstanceProfileName: cloudRIGInstanceProfileRoleName,
						RoleName: cloudRIGInstanceProfileRoleName
					},
					cb
				);
			}
		],
		cb
	);
}

function createCloudrigRole(cb) {
	async.series(
		[
			function (cb) {
				var policy = `{
				"Version": "2012-10-17",
				"Statement": {
					"Effect": "Allow",
					"Principal": {
						"Service": "logs.amazonaws.com",
						"Service": "ec2.amazonaws.com",
						"Service": "lambda.amazonaws.com",
						"Service": "events.amazonaws.com",
						"Service": "sns.amazonaws.com",
						"Service": "ssm.amazonaws.com"
					},
					"Action": "sts:AssumeRole"
				}
			}`;

				reporter.report(`Creating cloudRIG role '${cloudRIGRoleName}'`);

				iam.createRole(
					{
						AssumeRolePolicyDocument: policy,
						Path: "/",
						RoleName: cloudRIGRoleName
					},
					cb
				);
			},

			/*
		 
		This is for actions inside the created lambdas
		
		---------------------------------------------------
		EC2
		---------------------------------------------------
		
		- CreateImage
		> For saving current instance as AMI
		
		- CreateTags for type image & instance
		> Tagging new saved AMI
		> Tagging new instance
		
		- CancelSpotInstanceRequests
		- TerminateInstances where tag key cloudrig
		- Describe Instances where tag key cloudrig
		- Describe Images where tag key cloudrig
		- Run instances
		- Describe tags
		- Describe & report instance status
		
		- Describe EBS volumes
		- Attach EBS volumes

		- Describe spot price history

		- Deregister Image where tag key cloudrig
		> Remove old AMI
		
		- DeleteSnapshot
		> Old auto-saved AMIs

		- Reboot instances
		
		---------------------------------------------------
		CloudWatch Events
		---------------------------------------------------
		
		- DeleteRule
		- ListRules
		- RemoveTargets
		- PutTargets
		- PutRule
		- DisableRule
		
		---------------------------------------------------
		CloudWatch Logs
		---------------------------------------------------
		
		- CreateLogStream
		- PutLogEvents
		- CreateLogGroup
		
		---------------------------------------------------
		Lambda
		---------------------------------------------------
		
		- AddPermission
		- RemovePermission

		---------------------------------------------------
		SNS
		---------------------------------------------------

		- Publish

		---------------------------------------------------
		SSM
		---------------------------------------------------

		- ListCommandInvocations
		- SendCommand
		- DescribeInstanceInformation
		
		---------------------------------------------------
		IAM
		---------------------------------------------------

		- PassRole

		*/
			function (cb) {
				reporter.report(`Setting ${cloudRIGRoleName} policy`);

				var policy = `{
				"Version": "2012-10-17",
				"Statement": [
					{
						"Effect": "Allow",
						"Action": "ec2:CreateTags",
						"Resource": "*"
					},
					{
						"Effect": "Allow",
						"Action": "ec2:RebootInstances",
						"Resource": "arn:aws:ec2:*:*:instance/*"
					},
					{
						"Effect": "Allow",
						"Action": [
							"ec2:CreateImage",
							"ec2:DeleteSnapshot",
							"ec2:CancelSpotInstanceRequests",
							"ec2:DescribeInstances",
							"ec2:DescribeImages",
							"ec2:DeregisterImage",
							"ec2:TerminateInstances",
							"ec2:DescribeVolumes",
							"ec2:AttachVolume",
							"ec2:DescribeSpotPriceHistory",
							"ec2:RunInstances",
							"ec2:DescribeTags",
							"ec2:DescribeInstanceStatus",
							"ec2:ReportInstanceStatus"
						],
						"Resource": "*"
					},
					{
						"Effect": "Allow",
						"Action": [
							"events:DeleteRule",
							"events:ListRules",
							"events:RemoveTargets",
							"events:DisableRule"
						],
						"Resource": "arn:aws:events:*:*:rule/*"
					},
					{
						"Effect": "Allow",
						"Action": [
							"events:PutTargets",
							"events:PutRule"
						],
						"Resource": "*"
					},
					{
						"Effect": "Allow",
						"Action": [
							"lambda:AddPermission",
							"lambda:RemovePermission"
						],
						"Resource": "arn:aws:lambda:*:*:function:*"
					},
					{
						"Effect": "Allow",
						"Action": [
							"logs:CreateLogStream",
							"logs:PutLogEvents"
						],
						"Resource": "arn:aws:logs:*:*:log-group:*"
					},
					{
						"Effect": "Allow",
						"Action": "logs:PutLogEvents",
						"Resource": "arn:aws:logs:*:*:log-group:*:*:*"
					},
					{
						"Effect": "Allow",
						"Action": "logs:CreateLogGroup",
						"Resource": "*"
					},
					{
						"Effect": "Allow",
						"Action": "sns:Publish",
						"Resource": "arn:aws:sns:*:*:*"
					},
					{
						"Effect": "Allow",
						"Action": [
							"ssm:ListCommandInvocations",
							"ssm:SendCommand",
							"ssm:DescribeInstanceInformation"
						],
						"Resource": "*"
					},
					{
						"Effect": "Allow",
						"Action": "iam:PassRole",
						"Resource": "arn:aws:iam::*:role/*"
					}
				]
			}`;

				iam.putRolePolicy(
					{
						PolicyDocument: policy,
						PolicyName: cloudRIGRoleName + "-policy",
						RoleName: cloudRIGRoleName
					},
					cb
				);
			}
		],
		function (err) {
			if (err) {
				cb(err);
				return;
			}
			reporter.report("Waiting for permissions to propagate");
			setTimeout(cb, 10000);
		}
	);
}

function createKeyPair(cb) {
	ec2.createKeyPair(
		{
			KeyName: "cloudrig"
		},
		function (err, data) {
			if (err) {
				cb(err);
				return;
			}

			cb(null, data);
		}
	);
}

function createLambdaFunction(cb) {
	reporter.report("Creating Lambda function");

	// When one is made, delete all older ones
	var zip = new JSZip();
	zip.file("index.js", lambdaFunction());
	var tmpobj = tmp.fileSync();
	zip.generateNodeStream({
		type: "nodebuffer",
		streamFiles: true
	})
		.pipe(fs.createWriteStream(tmpobj.name))
		.on("finish", function () {
			lambda.createFunction(
				{
					Code: { ZipFile: fs.readFileSync(tmpobj.name) },
					Description: "",
					FunctionName: lambdaFunctionName,
					Handler: "index.handler",
					MemorySize: 128,
					Publish: true,
					Role: settings.cloudRIGRole,
					Runtime: "nodejs6.10",
					Timeout: 15,
					VpcConfig: {}
				},
				cb
			);
		});
}

function createSaveLambdaFunction(cb) {
	reporter.report("Creating Lambda save function");

	// When one is made, delete all older ones
	var zip = new JSZip();
	zip.file("index.js", lambdaSaveFunction());
	var tmpobj = tmp.fileSync();
	zip.generateNodeStream({
		type: "nodebuffer",
		streamFiles: true
	})
		.pipe(fs.createWriteStream(tmpobj.name))
		.on("finish", function () {
			lambda.createFunction(
				{
					Code: { ZipFile: fs.readFileSync(tmpobj.name) },
					Description: "",
					FunctionName: lambdaSaveFunctionName,
					Handler: "index.handler",
					MemorySize: 128,
					Publish: true,
					Role: settings.cloudRIGRole,
					Runtime: "nodejs6.10",
					Timeout: 15,
					VpcConfig: {}
				},
				cb
			);
		});
}

function createCloudWatchEvent(instanceId, cb) {
	reporter.report("Creating CloudWatch rule");

	cloudwatchevents.putRule(
		{
			Name: cloudWatchRulePrefix + "-" + instanceId,
			EventPattern: JSON.stringify({
				source: ["aws.ec2"],
				"detail-type": ["EC2 Instance State-change Notification"],
				detail: {
					state: ["stopped"],
					"instance-id": [instanceId]
				}
			}),
			State: "ENABLED"
		},
		function (err, ruleData) {
			if (err) {
				cb(err);
				return;
			}

			reporter.report("Creating CloudWatch target");

			cloudwatchevents.putTargets(
				{
					Rule: cloudWatchRulePrefix + "-" + instanceId,
					Targets: [
						{
							Arn: settings.lambda.FunctionArn,
							Id: "1"
						}
					]
				},
				function (err) {
					if (err) {
						cb(err);
						return;
					}

					reporter.report("Giving CloudWatch lambda permission");

					lambda.addPermission(
						{
							Action: "lambda:InvokeFunction",
							FunctionName: lambdaFunctionName,
							Principal: "events.amazonaws.com",
							SourceArn: ruleData.RuleArn,
							StatementId: "Statement-" + instanceId
						},
						cb
					);
				}
			);
		}
	);
}

// #endregion

// #region Delete

function deleteInstanceProfileByName(instanceProfileName, cb) {
	iam.deleteInstanceProfile(
		{
			InstanceProfileName: instanceProfileName
		},
		cb
	);
}

function deleteSpotInstance(instanceId, cb) {
	reporter.report("Deleting spot instance " + instanceId);

	ec2.terminateInstances(
		{
			InstanceIds: [instanceId]
		},
		cb
	);
}

function deleteSpotRequest(spotInstanceRequestId, cb) {
	reporter.report("Deleting spot request " + spotInstanceRequestId);

	ec2.cancelSpotInstanceRequests(
		{
			SpotInstanceRequestIds: [spotInstanceRequestId]
		},
		cb
	);
}

function deleteTags(resourceId, cb) {
	var params = {
		Resources: [resourceId],
		Tags: [
			{
				Key: "cloudrig",
				Value: "true"
			}
		]
	};

	ec2.deleteTags(params, function (err, data) {
		if (err) {
			cb(err);
			return;
		}

		cb(null, data);
	});
}

// #endregion

function sendAdHoc(cb, cmd) {
	cmd = cmd || getPS1(".adhoc.ps1");

	sendMessage(cmd, function (err, d) {
		if (err) {
			cb(err);
			return;
		}
		cb(null, d);
	});
}

function getState(cb) {
	async.parallel(
		[
			getActiveInstances,
			getCloudWatchEvent,
			getStoppingInstances,
			getCurrentSpotPrice,
			getPendingAMI,
			getEBSVolumes
		],
		function (err, results) {
			if (err) {
				cb(err);
				return;
			}

			var ret = {
				activeInstance: results[0].length > 0 ? results[0][0] : null,
				instanceReady: !!results[1],
				instanceStopping: results[2] && results[2].length > 0,
				scheduledStop: null,
				currentSpotPrice: results[3]
					? results[3].SpotPrice
					: results[3],
				remainingTime: null,
				savingInstance: !!results[4],
				volumes: results[5]
			};
			if (ret.activeInstance && ret.instanceReady) {
				async.parallel([getScheduledStop, getRemainingTime], function (
					err,
					results
				) {
					ret.scheduledStop = results[0] || null;
					ret.remainingTime = results[1].remainingMinutes;
					cb(null, ret);
					return;
				});
			} else {
				cb(null, ret);
			}
		}
	);
}

function getZonesArr() {
	return zonesArr;
}

function getRegions() {
	return Object.keys(zonesArr);
}

function getRegionAZs(region) {
	return zonesArr[region].map(function (z) {
		return region + z;
	});
}

function getInstanceTypesArr() {
	return ['g2.2xlarge', 'g3s.xlarge', 'g3.4xlarge']
}

function getRequiredConfig() {
	return [
		{
			key: "AWSCredentialsFile",
			title: "AWS Credentials File location",
			help: "e.g. " + homedir + "/.aws/credentials",
			validate: function (val) {
				if (!val) {
					return false;
				}
				return !fs.existsSync(val) || !fs.lstatSync(val).isFile()
					? "File does not exist"
					: true;
			}
		},
		{
			key: "AWSCredentialsProfile",
			title: "AWS Credentials Profile",
			help: "e.g. default",
			validate: function (val, answers) {
				if (!val) {
					return false;
				}
				var testCredentials = new AWS.SharedIniFileCredentials({
					filename: answers["AWSCredentialsFile"],
					profile: val
				});

				return !testCredentials.accessKeyId ? "Invalid profile" : true;
			}
		},
		{
			key: "AWSMaxPrice",
			title: "AWS Max Price",
			help:
				"The maximum amount you're prepared to pay per hour (e.g. 0.5 for 50c)",
			validate: function (val, answers) {
				if (!val) {
					return false;
				}
				val = parseFloat(val);
				if (val > 0.01 && val <= 1) {
					return true;
				}
				return "Please enter a value between 0.1 and 1 (like 0.5)";
			}
		},
		{
			key: "AWSRegion",
			title: "AWS Region",
			help: "Choose the one closest to you (try cloudping.info)",
			options: getRegions()
		},
		{
			key: "AWSAvailabilityZone",
			title: "AWS Availability Zone",
			help: "You jiggle this to find the best price",
			options: getRegionAZs,
			optionsDependsOnPreviousValues: ["AWSRegion"]
		},
		{
			key: "AWSInstanceType",
			title: "AWS Instace Type",
			help: "Choose how powerful your computer is",
			options: getInstanceTypesArr(),
		},
		{
			key: "ParsecServerId",
			title: "Parsec Server Id",
			help: "The Own Computer Server ID",
			validate: function (val) {
				return !!val;
			}
		}
	];
}

function validateRequiredConfig(configValues, cb) {
	// TODO: Use validator functions above
	var requiredConfig = getRequiredConfig().map(function (r) {
		return r.key;
	});

	var hasError = false;

	requiredConfig.forEach(function (configKey) {
		if (!configValues[configKey]) {
			hasError = true;
			return;
		}
	});

	if (hasError) {
		cb("You are missing fields");
		return;
	} else {
		var testCredentials = new AWS.SharedIniFileCredentials({
			filename: configValues.AWSCredentialsFile,
			profile: configValues.AWSCredentialsProfile
		});

		if (!testCredentials.accessKeyId) {
			cb("AWS profile not found");
			return;
		}
	}

	cb();
}

function stop(cb) {
	reporter.report("Stopping");

	getActiveInstances(function (err, instances) {
		sendMessage(getPS1("Stop-Computer.ps1"), function (err) {
			if (err) {
				cb(err);
				return;
			}

			function check() {
				ec2.describeInstances(
					{
						Filters: [
							{
								Name: "instance-state-name",
								Values: ["terminated"]
							}
						],
						InstanceIds: [instances[0].InstanceId]
					},
					function (err, data) {
						if (err) {
							cb(err);
							return;
						}

						if (
							data.Reservations[0] &&
							data.Reservations[0].Instances.length > 0
						) {
							reporter.report("Terminated");
							cb(null);
						} else {
							setTimeout(check, 2000);
						}
					}
				);
			}

			check();
		});
	});
}

function getCloudWatchEvent(cb) {
	getActiveInstances(function (err, instances) {
		if (instances.length > 0) {
			cloudwatchevents.listRules(
				{
					NamePrefix:
						cloudWatchRulePrefix + "-" + instances[0].InstanceId
				},
				function (err, data) {
					if (err) {
						cb(err);
						return;
					}

					cb(null, data.Rules[0]);
				}
			);
		} else {
			cb(null);
		}
	});
}

function getRemainingTime(cb) {
	getActiveInstances(function (err, instances) {
		if (err) {
			cb(err);
			return;
		}

		if (instances.length > 0) {
			var now = moment();

			cb(null, {
				now: now,
				remainingMinutes:
					59 -
					Math.floor(
						now.diff(instances[0].LaunchTime, "minutes", true) % 60
					),
				instanceId: instances[0].InstanceId
			});
		} else {
			cb(null, {
				remainingMinutes: "-"
			});
		}
	});
}

function getScheduledStop(cb) {
	getActiveInstances(function (err, instances) {
		if (err) {
			cb(err);
			return;
		}
		if (instances.length > 0) {
			cb(
				null,
				!!instances[0].Tags.find(function (tag) {
					return tag.Key === "scheduledstop";
				})
			);
		} else {
			cb();
		}
	});
}

function cancelScheduledStop(cb) {
	reporter.report("Cancelling scheduled stop");

	getActiveInstances(function (err, instances) {
		if (err) {
			cb(err);
			return;
		}

		sendMessage(getPS1("Cancel-Scheduled-Shutdown.ps1"), function (
			err,
			data
		) {
			if (err) {
				cb(err);
				return;
			}

			ec2.deleteTags(
				{
					Resources: [instances[0].InstanceId],
					Tags: [
						{
							Key: "scheduledstop",
							Value: "true"
						}
					]
				},
				function (err, data) {
					if (err) {
						cb(err);
						return;
					}

					cb();
				}
			);
		});
	});
}

function scheduleStop(cb) {
	reporter.report("Scheduling stop");

	getRemainingTime(function (err, data) {
		if (err) {
			cb(err);
			return;
		}

		reporter.report("Stopping in " + data.remainingMinutes + " minutes");

		async.parallel(
			[
				function (cb) {
					sendMessage(
						getPS1("Schedule-Shutdown-Notification_tpl.ps1")
							.replace(/__CLOUDRIG_REASON__/, "scheduled")
							.replace(
								/__CLOUDRIG_REMAININGMINUTES__/,
								data.remainingMinutes - 3
							),
						cb
					);
				},

				function (cb) {
					sendMessage(
						getPS1("Schedule-Shutdown_tpl.ps1").replace(
							/__CLOUDRIG_REMAININGMINUTES__/,
							data.remainingMinutes - 1
						),
						cb
					);
				}
			],
			function (err) {
				if (err) {
					cb(err);
					return;
				}

				ec2.createTags(
					{
						Resources: [data.instanceId],
						Tags: [
							{
								Key: "scheduledstop",
								Value: "true"
							}
						]
					},
					function (err, data) {
						if (err) {
							cb(err);
							return;
						}

						cb();
					}
				);
			}
		);
	});
}

/*
FROM http://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/EC2.html#runInstances-property
"The type of resource to tag. Currently, the resource types that support tagging on creation are instance and volume."
*/

function getSpotInstanceRequests(cb) {
	getActiveInstances(function (err, instances) {
		if (instances[0]) {
			ec2.describeSpotInstanceRequests(
				{
					SpotInstanceRequestIds: [instances[0].SpotInstanceRequestId]
				},
				function (err, data) {
					if (err) {
						cb(err);
						return;
					}

					if (data.SpotInstanceRequests.length > 0) {
						cb(null, data.SpotInstanceRequests);
					} else {
						cb(null, []);
					}
				}
			);
		} else {
			cb(null, []);
		}
	});
}

// If no AMI, make it and run
// If instance exists, start it again
function start(cb) {

	AWS.config.region = config.AWSRegion;
	cloudwatchlogs = new AWS.CloudWatchLogs();

	var userID = settings.cloudRIGInstanceProfile.substring(
		settings.cloudRIGInstanceProfile.indexOf("aws:iam::") + 9,
		settings.cloudRIGInstanceProfile.indexOf(":instance-profile"));

	var lambdaInput = `{
		"default": "",
		"config": {
		  "AWSRegion": "${config.AWSRegion}",
		  "AWSAvailabilityZone": "${config.AWSAvailabilityZone}",
		  "AWSMaxPrice": "${config.AWSMaxPrice}",
		  "AWSInstanceType": "${config.AWSInstanceType}",
		  "ParsecServerId": "${config.ParsecServerId}"
		},
		"settings": {
		  "UserID": "${userID}",
		  "cloudRIGInstanceProfile": "${settings.cloudRIGInstanceProfile}",
		  "KeyName": "${settings.KeyName}",
		  "SecurityGroupId": "${settings.SecurityGroupId}",
		  "lambda": {
			"FunctionArn": "${settings.lambda.FunctionArn}"
		  }
		}
	  }`

	lambda.invoke(
		{
			FunctionName: "cloudrig-start",
			Payload: lambdaInput
		},
		function (err, data) {
			if (err) {
				console.log(err);
			}
			logStartup(cb, data.Payload)
		}
	);

}

function sendMessage(commands, cb) {
	commands = !Array.isArray(commands) ? [commands] : commands;

	getActiveInstances(function (err, instances) {
		if (err) {
			cb(err);
			return;
		}

		var instanceId = instances[0].InstanceId;

		var params = {
			DocumentName: "AWS-RunPowerShellScript",
			InstanceIds: [instanceId],
			Parameters: {
				commands: commands
			}
		};

		ssm.sendCommand(params, function (err, data) {
			if (err) {
				cb(err);
				return;
			}

			function check() {
				ssm.listCommandInvocations(
					{
						CommandId: data.Command.CommandId,
						InstanceId: instanceId,
						Details: true
					},
					function (err, data) {
						if (err) {
							cb(err);
							return;
						}

						if (
							data.CommandInvocations &&
							data.CommandInvocations.length > 0 &&
							data.CommandInvocations[0].Status == "Success" &&
							!!data.CommandInvocations[0].CommandPlugins[0]
								.Output
						) {
							cb(
								null,
								data.CommandInvocations[0].CommandPlugins[0]
									.Output
							);
						} else {
							setTimeout(check, 2000);
						}
					}
				);
			}

			check();
		});
	});
}

function clearSettings(cb) {
	let toClear = [];

	getSetup(function (err, results) {
		if (err) {
			cb(err);
			return;
		}

		var cloudRIGRole = results[0];
		var lambda = results[5];
		var lambdaSave = results[6];

		if (cloudRIGRole) {
			toClear.push(deleteAllRolesAndInstanceProfile);
		}

		if (lambda) {
			toClear.push(deleteLambda);
		}

		if (lambdaSave) {
			toClear.push(deleteLambdaSave);
		}

		if (toClear) {
			async.series(toClear, err => {
				if (err) {
					cb(err);
					return;
				}

				cb(null, {
					code: 1,
					message: "Ready"
				});
			});
		} else {
			cb(null, {
				code: 2,
				message: "Nothing to clear"
			});
		}
	});
}

// Clear up this version's setup ready for new code
function prepareUpdate(cb) {
	getState((err, state) => {
		if (err) {
			cb(err);
			return;
		}

		// Possibly add state check for if transferring volume
		if (
			state.activeInstance ||
			state.instanceStopping ||
			state.savingInstance
		) {
			cb(null, {
				code: -1,
				message:
					"You have an active / stopping / saving instance. Please try again when it has finished."
			});
			return;
		}
		clearSettings(function (err) {
			if (err) {
				cb(err);
				return;
			}

			fs.writeFileSync(updateFlagFile, "");

			cb(null, {
				code: 1
			});
		});
	});
}

function setup(cb) {
	credentials = new AWS.SharedIniFileCredentials({
		filename: config.AWSCredentialsFile,
		profile: config.AWSCredentialsProfile
	});

	AWS.config.credentials = credentials;
	AWS.config.region = config.AWSRegion;

	iam = new AWS.IAM();
	ec2 = new AWS.EC2();
	ssm = new AWS.SSM();
	lambda = new AWS.Lambda();
	cloudwatchevents = new AWS.CloudWatchEvents();

	const isUpdate = fs.existsSync(updateFlagFile);
	if (isUpdate) {
		async.series(
			[
				cb => {
					doSetup(cb, true);
				},
				cb => {
					reporter.report("unlink " + updateFlagFile);
					fs.unlinkSync(updateFlagFile);
					cb();
				}
			],
			cb
		);
	} else {
		doSetup(cb);
	}
}

function getSetup(cb) {
	async.parallel(
		[
			getCloudRIGRole,
			getCloudRIGInstanceProfileRole,
			getCloudRIGInstanceProfile,
			getSecurityGroup,
			getIPAddress,
			getLambdaFunction,
			getLambdaSaveFunction,
			getKeyPair,
			getActiveInstances
		],
		cb
	);
}

function doSetup(cb, isUpdate) {
	reporter.report("Do setup. isUpdate = " + !!isUpdate);

	getSetup(function (err, results) {
		if (err) {
			cb(err);
			return;
		}

		var cloudRIGRole = results[0];
		var cloudRIGInstanceProfileRole = results[1];
		var cloudRIGInstanceProfile = results[2];
		var securityGroup = results[3];
		var ipAddress = results[4];
		var lambda = results[5];
		var lambdaSave = results[6];
		var keyPair = results[7];
		var activeInstances = results[8];

		var questions = [];

		if (!keyPair) {
			questions.push({
				q: "Shall I make a Key Pair called 'cloudrig'?",
				m: function (cb) {
					createKeyPair(function (err, data) {
						if (err) {
							cb(err);
							return;
						}

						var keyPath = cloudrigDir + config.AWSRegion

						if (!fs.existsSync(keyPath)) {
							fs.mkdirSync(keyPath);
						}

						userDataFileWriter(
							config.AWSRegion + '/' + securityKeyPairName,
							data.KeyMaterial
						);
						reporter.report("PEM saved " + keyPath + '/' + securityKeyPairName);

						cb();
					});
				}.bind(this)
			});
		} else {
			settings.KeyName = keyPair.KeyName;
		}

		if (!cloudRIGRole) {
			questions.push({
				q: "Shall I make a role called " + cloudRIGRoleName,
				m: createCloudrigRole.bind(this)
			});
		} else {
			settings.cloudRIGRole = cloudRIGRole.Arn;

			if (!lambdaSave) {
				questions.push({
					q:
						"Shall I make a make a lambda function called '" +
						lambdaSaveFunctionName +
						"' for autosaving cloudRIG?",
					m: createSaveLambdaFunction.bind(this)
				});
			} else {
				settings.lambdaSave = lambdaSave;

				if (!lambda) {
					questions.push({
						q:
							"Shall I make a make a lambda function called '" +
							lambdaFunctionName +
							"' for cloudRIG state watching?",
						m: createLambdaFunction.bind(this)
					});
				} else {
					settings.lambda = lambda;
				}
			}
		}

		if (!cloudRIGInstanceProfileRole) {
			questions.push({
				q:
					"Shall I make an instance profile role called " +
					cloudRIGInstanceProfileRoleName,
				m: createCloudrigInstanceProfileRole.bind(this)
			});
		} else if (!cloudRIGInstanceProfile) {
			questions.push({
				q:
					"Shall I make an instance profile called " +
					cloudRIGInstanceProfileRoleName,
				m: createCloudrigInstanceProfile.bind(this)
			});
		} else {
			settings.cloudRIGInstanceProfile = cloudRIGInstanceProfile.Arn;
		}

		if (!securityGroup) {
			questions.push({
				q: "Shall I make a cloudRIG security group for you?",
				m: createSecurityGroup.bind(this)
			});
		} else {
			settings.SecurityGroupId = securityGroup.GroupId;

			// Check if current IP is in security group

			var exists =
				securityGroup.IpPermissions.length !== 0 &&
				securityGroup.IpPermissions[0][
					!ipAddress[1] ? "IpRanges" : "Ipv6Ranges"
				].findIndex(function (range) {
					return (
						range[!ipAddress[1] ? "CidrIp" : "CidrIpv6"].indexOf(
							ipAddress[0]
						) !== -1
					);
				}) !== -1;

			if (!exists) {
				questions.push({
					q:
						"Your IP Address " +
						ipAddress[0] +
						" isn't in the security group. Shall I add it?",
					m: addIPToSecurityGroup.bind(
						this,
						securityGroup.GroupId,
						ipAddress[0],
						ipAddress[1]
					)
				});
			}
		}

		if (questions.length > 0 && isUpdate) {
			async.series(
				questions.map(function (q) {
					return q.m;
				}),
				function (err) {
					if (err) {
						cb(err);
						return;
					}
					doSetup(cb, true);
				}
			);
		} else if (questions.length === 0 && activeInstances.length > 0) {
			reporter.report("Checking instance");

			getCloudWatchEvent(function (err, rules) {
				if (err) {
					cb(err);
					return;
				}

				if (!rules) {
					reporter.report("No shut down rule, so making one...");

					createCloudWatchEvent(
						activeInstances[0].InstanceId,
						function (err) {
							if (err) {
								cb(err);
								return;
							}

							cb(null, {
								code: 1
							});
						}
					);
				} else {
					cb(null, {
						code: 1
					});
				}
			});
		} else if (questions.length === 0) {
			cb(null, {
				code: 1
			});
		} else {
			cb(null, {
				code: 2,
				questions: questions
			});
		}
	});
}

function logStartup(cb, startTime) {
	var startPattern = `[cloudrigrun${startTime}]`;

	var seenEventIds = [];

	var groups = [
		"/aws/lambda/cloudrig-deleteRequestAndInstance",
		"/aws/lambda/cloudrig-deleteRollbackRule",
		"/aws/lambda/cloudrig-createCloudWatchEvent",
		"/aws/lambda/cloudrig-reboot",
		"/aws/lambda/cloudrig-checkMessageSuccess",
		"/aws/lambda/cloudrig-sendMessage",
		"/aws/lambda/cloudrig-attachEBSVolume",
		"/aws/lambda/cloudrig-waitSSM",
		"/aws/lambda/cloudrig-waitForInstanceOk",
		"/aws/lambda/cloudrig-request",
		"/aws/lambda/cloudrig-checkSpotPrice",
		"/aws/lambda/cloudrig-getBaseAMI",
		"/aws/lambda/cloudrig-start"
	];
	var complete = false;

	function check() {

		var sortArray = [];

		async.eachLimit(groups, 1, (group, cb) => {
			cloudwatchlogs.filterLogEvents({
				logGroupName: group,
				filterPattern: `"${startPattern}"`
			}, function (err, data) {

				if (data) {
					if (data.events) {
						data.events.forEach(event => {
							if (!seenEventIds.includes(event.eventId)) {
								seenEventIds.push(event.eventId);
								let message = event.message.substring(event.message.
									lastIndexOf(startPattern) + startPattern.length);

								sortArray.push(
									{
										timestamp: event.timestamp,
										message: message.substr(2, message.length - 4)
									}
								);
							}
						});

					}
				}
				cb();

			})
		}, () => {
			var sorted = sortArray.sort((a, b) => {
				if (a.timestamp == b.timestamp) {
					return 0;
				}
				else if (a.timestamp > b.timestamp) {
					return 1;
				}
				else {
					return -1;
				}
			}).forEach(event => {
				if (event.message.includes("[FATALERROR]")){
					complete = true;
					return;
				}

				reporter.report(event.message);
				if (event.message == "No more functions in lambda queue") {
					complete = true;
				}
			});
		})


		if (!complete) {
			setTimeout(check, 10000);
		}
		else {
			cb();
			return;
		}

	}

	check();
}


module.exports = {
	id: "AWS",

	getRequiredConfig: getRequiredConfig,

	validateRequiredConfig: validateRequiredConfig,

	getState: getState,

	setConfig: function (_config) {
		config = _config;
	},

	init: function (reporterMethod) {
		setReporter(reporterMethod);

		if (!fs.existsSync(cloudrigDir)) {
			fs.mkdirSync(cloudrigDir);
		}

		// TODO: Make this safer for already existing config file
		// fs.existsSync
		try {
			getConfigFile();
		} catch (ex) {
			reporter.report(
				"[!] Config file missing/broken - copying from config.sample.json"
			);
			setConfigFile(
				JSON.parse(fs.readFileSync(__dirname + "/config.sample.json"))
			);
		}
	},

	setup: setup,

	getActiveInstances: getActiveInstances,

	getPending: getPendingInstances,

	getStoppingInstances: getStoppingInstances,

	getPublicDNS: getPublicDNS,

	getZonesArr: getZonesArr,

	getInstanceTypesArr: getInstanceTypesArr,

	getRegions: getRegions,

	getRegionAZs: getRegionAZs,

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

	transferEBSVolume: transferEBSVolume,

	expandEBSVolume: expandEBSVolume,

	deleteRole: deleteRole,

	deleteInstanceProfile: deleteInstanceProfile,

	deleteInstanceProfileRole: deleteInstanceProfileRole,

	deleteAllRolesAndInstanceProfile: deleteAllRolesAndInstanceProfile,

	deleteLambda: deleteLambda,

	deleteLambdaSave: deleteLambdaSave,

	prepareUpdate: prepareUpdate,

	_sendAdHoc: sendAdHoc,

	_getInstanceProfiles: getInstanceProfiles,

	_getSettings: getSettings,

	_deleteInstanceProfileByName: deleteInstanceProfileByName,

	_createSecurityGroup: createSecurityGroup
};
