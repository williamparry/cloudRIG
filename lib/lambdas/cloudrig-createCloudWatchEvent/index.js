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

        var lambda = new AWS.Lambda();
        
        common.report("Creating CloudWatch rule");

        cloudwatchevents.putRule(
            {
                Name: "cloudrig-watch-" + eventBody.state.instance.InstanceId,
                EventPattern: JSON.stringify({
                    source: ["aws.ec2"],
                    "detail-type": ["EC2 Instance State-change Notification"],
                    detail: {
                        state: ["stopped"],
                        "instance-id": [eventBody.state.instance.InstanceId]
                    }
                }),
                State: "ENABLED"
            },
            function (err, ruleData) {
                if (err) {
                    common.triggerRollback(err);
                    return;
                }

                common.report("Creating CloudWatch target");

                cloudwatchevents.putTargets(
                    {
                        Rule: "cloudrig-watch-" + eventBody.state.instance.InstanceId,
                        Targets: [
                            {
                                Arn: eventBody.settings.lambda.FunctionArn,
                                Id: "1"
                            }
                        ]
                    },
                    function (err) {
                        if (err) {
                            common.triggerRollback(err);
                            return;
                        }

                        common.report("Giving CloudWatch lambda permission");

                        lambda.addPermission(
                            {
                                Action: "lambda:InvokeFunction",
                                FunctionName: "cloudrig-lambda",
                                Principal: "events.amazonaws.com",
                                SourceArn: ruleData.RuleArn,
                                StatementId: "Statement-" + eventBody.state.instance.InstanceId
                            },
                            function(err,data) {
                                if (err) {
                                    common.triggerRollback(err);
                                    return;
                                }

                                common.triggerNextLambda(lambdaARNQueue, eventBody);
                            }
                        );
                    }
                );
            }
        );
    }

    common.start(run, eventBody);



}