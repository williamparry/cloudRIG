exports.handler = (event, context, callback) => {
	var AWS = require("aws-sdk");
	var ec2 = new AWS.EC2();
	var cloudwatchevents = new AWS.CloudWatchEvents();

	var eventBody = event;

	if (event.Records) {
		eventBody = JSON.parse(event.Records[0].Sns.Message);
	}

	function run() {
		console.log("Tagging spot instance " + eventBody.InstanceId + " as cancelled");
		ec2.createTags(
			{
				Resources: [eventBody.InstanceId],
				Tags: [
					{
						Key: "cancelled",
						Value: "true"
					}
				]
			},
			function(err, data) {
				if (err) {
					console.log(err);
				}

				console.log("Terminating spot instance " + eventBody.InstanceId);
				ec2.terminateInstances(
					{
						InstanceIds: [eventBody.InstanceId]
					},
					function(err, data) {
						if (err) {
							console.log(err);
						}

						console.log("Deleting spot request " + eventBody.spotInstanceRequestId);
						ec2.cancelSpotInstanceRequests(
							{
								SpotInstanceRequestIds: [eventBody.spotInstanceRequestId]
							},
							function(err, data) {
								if (err) {
									console.log(err);
									return;
								}

								cloudwatchevents.deleteRule(
									{
										Name: "cloudrig-startup-watch"
									},
									function(err, data) {
										if (err) {
											console.log(err);
											return;
										}
									}
								);
							}
						);
					}
				);
			}
		);
	}

	run();
};
