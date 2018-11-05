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
		ec2.describeInstanceStatus(
			{
				InstanceIds: [eventBody.state.instance.InstanceId]
			},
			function (err, data) {
				if (err) {
					common.triggerRollback(err);
					return;
				}

				if (
					data.InstanceStatuses.length > 0 &&
					data.InstanceStatuses[0].InstanceStatus.Status == "ok"
				) {
					common.report("Instance ready");
					common.triggerNextLambda(lambdaARNQueue, eventBody);
				}
				else {
					setTimeout(check, 15000);
				}

			}
		);
	}


	function run() {
		common.report("Waiting for our instance to be ready");

		check();
	}

	common.start(run, eventBody);
};
