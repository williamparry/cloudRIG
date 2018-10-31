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
		var ssm = new AWS.SSM();

		ssm.listCommandInvocations(
			{
				CommandId: eventBody.args,
				InstanceId: eventBody.state.instance.InstanceId,
				Details: true
			},
			function(err, data) {
				if (err) {
					common.triggerRollback(err);
					return;
				}

				if (
					data.CommandInvocations &&
					data.CommandInvocations.length > 0 &&
					data.CommandInvocations[0].Status == "Success" &&
					!!data.CommandInvocations[0].CommandPlugins[0].Output
				) {
					common.report("Command completed successfully");
					common.triggerNextLambda(lambdaARNQueue, eventBody);
				} else {
					var checkMessageSuccess = {
						arn:
							"arn:aws:sns:" +
							eventBody.config.AWSRegion +
							":" +
							eventBody.settings.UserID +
							":cloudrig-checkMessageSuccess",
						args: eventBody.args
					};
					lambdaARNQueue.unshift(checkMessageSuccess);
					common.scheduleNextLambda("1 minute", lambdaARNQueue, eventBody);
				}
			}
		);
	}

	common.start(run, eventBody);
};
