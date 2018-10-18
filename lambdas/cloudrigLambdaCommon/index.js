var AWS = require("aws-sdk");
var sns = new AWS.SNS();
var ec2 = new AWS.EC2();
var cloudwatchevents = new AWS.CloudWatchEvents();

var standardFilter = [
    {
        Name: "tag:cloudrig",
        Values: ["true"]
    }
];
var cloudWatchSavePrefix = "cloudrig-save";

// Reporter, should send to cloudwatch
function report(message) {
    console.log(message);
}

// Trigger the next lambda in the queue
function triggerNextLambda(lambdaARNQueue, eventBody) {
    // Trigger next lambda in queue
    if (lambdaARNQueue.length == 0) {
        report("No more functions in lambda queue")
    }
    else {
        report("Triggering next lambda via SNS");

        var nextFunc = lambdaARNQueue.shift();
        eventBody.lambdaARNQueue = lambdaARNQueue;
        eventBody.args = nextFunc.args;

        report("ARN of SNS to be triggered is " + nextFunc.arn);
        report("Argument of lambda is" + nextFunc.args);

        sns.publish({
            Message: JSON.stringify(eventBody),
            TopicArn: nextFunc.arn
        }
            , function (err, data) {
                if (err) {
                    report(err);
                    return;
                }
                report(data);
            });
    }
}

// Trigger the next lambda in the queue after the specified delay (granularity 1 minute)
function scheduleNextLambda(rate, lambdaARNQueue, eventBody) {
    // Trigger next lambda in queue
    if (lambdaARNQueue.length == 0) {
        report("No more functions in lambda queue")
    }
    else {
        report("Triggering next lambda via cloudwatch rule in "
            + rate);

        var nextFunc = lambdaARNQueue.shift();
        eventBody.lambdaARNQueue = lambdaARNQueue;
        eventBody.args = nextFunc.args;

        report("ARN of SNS to be triggered is " + nextFunc.arn);
        report("Argument of lambda is" + nextFunc.args);

        cloudwatchevents.removeTargets({
            Ids: ["scheduled"],
            Rule: "ScheduleLambda"
        }, function (err, data) {
            if (err) {
                report(err);
                return;
            }

            cloudwatchevents.putTargets({
                Rule: "ScheduleLambda",
                Targets: [{
                    Arn: nextFunc.arn,
                    Input: JSON.stringify(eventBody),
                    Id: "scheduled"
                }]
            }, function (err, data) {
                if (err) {
                    report(err);
                    return;
                }

                cloudwatchevents.putRule({
                    Name: "ScheduleLambda",
                    ScheduleExpression: "rate(" + rate + ")",
                    State: "ENABLED"
                },
                    function (err, data) {
                        if (err) {
                            report(err);
                            return;
                        }
                    })
            });

        });

    }
}

// Run the start functions for the lambda, then call the run callback 
function start(runCB, eventBody) {
    // Disable the schedulelambda rule, since it might have been enabled to
    // trigger this lambda
    cloudwatchevents.disableRule({ Name: "ScheduleLambda" },
        function (err, data) {
            if (err) {
                report(err);
            }

            // Check that the instance isn't cancelled/still exists
            ec2.describeTags({
                Filters: [
                    {
                        Name: "resource-id",
                        Values: [
                            eventBody.state.instance.InstanceId
                        ]
                    }
                ]
            },
                function (err, data) {
                    if (err) {
                        report(err);
                        return;
                    }

                    if (data.Tags.some(function (tag) {
                        return tag.Key == "cancelled";
                    })) {
                        report("Instance marked as cancelled");
                        return;
                    }

                    if (data.Tags.length == 0) { // Instance doesn't exist
                        report("Instance not found");
                        return;
                    }

                    runCB();

                });
        });
}




module.exports = {
    standardFilter: standardFilter,
    report: report,
    scheduleNextLambda: scheduleNextLambda,
    start: start,
    triggerNextLambda: triggerNextLambda
}