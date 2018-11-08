exports.handler = (event, context, callback) => {
	var commonlib = require("common.js");

	var AWS = require("aws-sdk");
	var sns = new AWS.SNS();
	var ec2 = new AWS.EC2();
	var cloudwatchevents = new AWS.CloudWatchEvents();

	var eventBody = JSON.parse(event.Records[0].Sns.Message);
	var lambdaARNQueue = eventBody.lambdaARNQueue;
	var common = new commonlib(eventBody);

	function check() {

		var ssm = new AWS.SSM();

		ssm.describeInstanceInformation(
			{
				Filters: [
					{
						Key: "InstanceIds",
						Values: [eventBody.state.instance.InstanceId]
					}
				]
			},
			function(err, data) {
				if (err) {
					common.triggerRollback(err);
					return;
				}

				if (data.InstanceInformationList.length > 0) {
					common.triggerNextLambda(lambdaARNQueue, eventBody);
				} else {
					setTimeout(check, 2000);
				}
			}
		);
	}


	function run() {
		common.report("Waiting for SSM");

		check();

	}

	common.start(run, eventBody);
};
