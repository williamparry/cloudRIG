exports.handler = (event, context, callback) => {
	var commonlib = require("common.js");
	var AWS = require("aws-sdk");
	var sns = new AWS.SNS();
	var ec2 = new AWS.EC2();
	var cloudwatchevents = new AWS.CloudWatchEvents();

	var eventBody = JSON.parse(event.Records[0].Sns.Message);
	var lambdaARNQueue = eventBody.lambdaARNQueue;
	var common = new commonlib(eventBody);

	function run() {
		common.report("Waiting for our instance to be ready");

		ec2.waitFor(
			/* Assuming instanceOk doesn't take long to happen,
            * otherwise this needs to be changed to a cloudwatch rule,
            * lambda function will timeout if takes too long.
            */
			"instanceStatusOk",
			{
				InstanceIds: [eventBody.state.instance.InstanceId]
			},
			function(err, data) {
				if (err) {
					common.triggerRollback(err);
					return;
				}
				common.report("Instance ready");
				common.triggerNextLambda(lambdaARNQueue, eventBody);
			}
		);
	}

	common.start(run, eventBody);
};
