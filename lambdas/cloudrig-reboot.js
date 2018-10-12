exports.handler = (event, context, callback) => {
    var AWS = require("aws-sdk");
    var sns = new AWS.SNS();
    var ec2 = new AWS.EC2();
    var cloudwatchevents = new AWS.CloudWatchEvents();


    var eventBody = JSON.parse(event.Records[0].Sns.Message);
    var lambdaARNQueue = eventBody.lambdaARNQueue;

    function scheduleNextLambda(rate) {
        // Trigger next lambda in queue
        if (lambdaARNQueue.length == 0) {
            console.log("No more functions in lambda queue")
        }
        else {
            console.log("Triggering next lambda via cloudwatch rule in "
                + rate);

            var nextFunc = lambdaARNQueue.shift();
            eventBody.lambdaARNQueue = lambdaARNQueue;
            eventBody.args = nextFunc.args;

            console.log("ARN of SNS to be triggered is " + nextFunc);

            cloudwatchevents.removeTargets({
                Ids: ["scheduled"],
                Rule: "ScheduleLambda"
            }, function (err, data) {
                if (err) {
                    console.log(err);
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
                        console.log(err);
                        return;
                    }

                    cloudwatchevents.putRule({
                        Name: "ScheduleLambda",
                        ScheduleExpression: "rate(" + rate + ")",
                        State: "ENABLED"
                    },
                        function (err, data) {
                            if (err) {
                                console.log(err);
                                return;
                            }
                        })
                });

            });

        }
    }

    function run() {
        console.log("Rebooting cloudrig instance");

        ec2.rebootInstances(
            {
                InstanceIds: [eventBody.state.instance.InstanceId]
            },
            function (err, data) {
                if (err) {
                    console.log(err);
                    return;
                }
                scheduleNextLambda("1 minute");
            }
        );
    }

    // Disable the schedulelambda rule, since it might have been enabled to
    // trigger this lambda
    cloudwatchevents.disableRule({ Name: "ScheduleLambda" },
        function (err, data) {
            if (err) {
                console.log(err);
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
                        console.log(err);
                        return;
                    }

                    if (data.Tags.some(function (tag) {
                        return tag.Key == "cancelled";
                    })) {
                        console.log("Instance marked as cancelled");
                        return;
                    }

                    if (data.Tags.length == 0) { // Instance doesn't exist
                        console.log("Instance not found");
                        return;
                    }

                    run();

                });
        });

};

