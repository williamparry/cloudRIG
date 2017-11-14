var AWS = require('aws-sdk');

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
							FunctionName: "cloudrig-lambda",
							StatementId: "Statement-" + instanceId
			
						}, function(err) {

							if (err) { callback(err); return; }

							console.log("Deleting cloud watch targets");
							
							cloudwatchevents.removeTargets({
								Ids: [ '1' ],
								Rule: "cloudrig-watch-" + instanceId
							}, function(err, data) {

								if (err) { callback(err); return; }

								console.log("Deleting cloud watch rule");

								cloudwatchevents.deleteRule({
									Name: "cloudrig-watch-" + instanceId
								}, function(err, data) {

									if (err) { callback(err); return; }

									console.log("Deleting cloud stop targets");

									cloudwatchevents.removeTargets({
										Ids: [ '2' ],
										Rule: "cloudrig-stop-" + instanceId
									}, function(err, data) {

										if (err) { callback(err); return; }

										console.log("Deleting cloud stop rule");

										cloudwatchevents.deleteRule({
											Name: "cloudrig-stop-" + instanceId
										}, function(err, data) {
											
											console.log("Deleting cloud notify targets");

											cloudwatchevents.removeTargets({
												Ids: [ '3' ],
												Rule: "cloudrig-notify-" + instanceId
											}, function(err, data) {

												if (err) { callback(err); return; }

												console.log("Deleting cloud notify rule");

												cloudwatchevents.deleteRule({
													Name: "cloudrig-notify-" + instanceId
												}, callback);

											});

										});

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
};