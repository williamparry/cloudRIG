exports.handler = (event, context, callback) => {
    var AWS = require("aws-sdk");
    var sns = new AWS.SNS();
    var ec2 = new AWS.EC2();
    var cloudwatchevents = new AWS.CloudWatchEvents();


    var eventBody = JSON.parse(event.Records[0].Sns.Message);
    var lambdaARNQueue = eventBody.lambdaARNQueue;

    function triggerNextLambda() {
        // Trigger next lambda in queue
        if (lambdaARNQueue.length == 0) {
            console.log("No more functions in lambda queue")
        }
        else {
            console.log("Triggering next lambda via SNS");

            var nextFunc = lambdaARNQueue.shift();
            eventBody.lambdaARNQueue = lambdaARNQueue;
            eventBody.args = nextFunc.args;

            console.log("ARN of SNS to be triggered is " + nextFunc);

            sns.publish({
                Message: JSON.stringify(eventBody),
                TopicArn: nextFunc.arn
            }
                , function (err, data) {
                    if (err) {
                        console.log(err);
                        return;
                    }
                    console.log(data);
                });
        }
    }

    function run() {
        ec2.describeVolumes(
            [
                {
                    Name: "tag:cloudrig",
                    Values: ["true"]
                }
            ],
            function (err, data) {
                if (err) {
                    console.log(err);
                    return;
                }

                var volumes = data.Volumes.filter(function (v) {
                    return v.AvailabilityZone === eventBody.state.availabilityZone;
                });

                // Exists
                if (volumes[0]) {
                    console.log("Found EBS Volume");

                    eventBody.state.volumeId = volumes[0].VolumeId;

                    ec2.attachVolume(
                        {
                            Device: "xvdb",
                            InstanceId: eventBody.state.instance.InstanceId,
                            VolumeId: eventBody.state.volumeId
                        },
                        function (err, data) {
                            if (err) {
                                console.log(err);
                                return;
                            }
                            triggerNextLambda();
                        }
                    );
                } else {
                    console.log("Did not find EBS Volume");

                }

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

