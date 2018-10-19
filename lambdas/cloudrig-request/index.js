exports.handler = (event, context, callback) => {

    var commonlib = require("cloudrigLambdaCommon");
    var common = new commonlib(eventBody);
    var AWS = require("aws-sdk");
    var sns = new AWS.SNS();
    var ec2 = new AWS.EC2();
    var cloudwatchevents = new AWS.CloudWatchEvents();

    var eventBody = JSON.parse(event.Records[0].Sns.Message);
    var lambdaARNQueue = eventBody.lambdaARNQueue;

    function run() {
        ec2.runInstances(
            {
                MinCount: 1,
                MaxCount: 1,
                EbsOptimized: true,
                InstanceMarketOptions: {
                    MarketType: "spot",
                    SpotOptions: {
                        MaxPrice: eventBody.config.AWSMaxPrice || "0.4",
                        SpotInstanceType: "persistent",
                        InstanceInterruptionBehavior: "stop"
                    }
                },
                TagSpecifications: [
                    {
                        ResourceType: "instance",
                        Tags: [
                            {
                                Key: "cloudrig",
                                Value: "true"
                            }
                        ]
                    }
                ],
                IamInstanceProfile: {
                    Arn: eventBody.settings.cloudRIGInstanceProfile
                },
                UserData: new Buffer(
                    `network_server_start_port=8000:app_host=1:server_key=${
                    eventBody.config.ParsecServerId
                    }:app_check_user_data=1:app_first_run=0`
                ).toString("base64"),
                Placement: {
                    AvailabilityZone: eventBody.state.availabilityZone
                },
                ImageId: eventBody.state.ImageId,
                InstanceType: eventBody.config.AWSInstanceType,
                KeyName: eventBody.settings.KeyName,
                SecurityGroupIds: [eventBody.settings.SecurityGroupId]
            },
            function (err, data) {
                if (err) {
                    common.report(err);
                    return;
                }


                if (
                    data.Instances[0].StateReason.Message ==
                    "Server.InsufficientInstanceCapacity" ||
                    data.Instances[0].StateReason.Message == "Server.InternalError"
                ) {
                    common.report(data.Instances[0].StateReason.Message)
                    return;
                }

                eventBody.state.spotInstanceRequestId = data.Instances[0].SpotInstanceRequestId;
                eventBody.state.instance = {};
                eventBody.state.instance.InstanceId = data.Instances[0].InstanceId;

                cloudwatchevents.putRule(
                    {
                        Name: "cloudrig-startup-watch",
                        EventPattern: JSON.stringify(
                            {
                                "source": [
                                    "aws.ec2"
                                ],
                                "detail-type": [
                                    "EC2 Spot Instance Interruption Warning"
                                ]
                            }
                        ),
                        State: "ENABLED"
                    },
                    function (err, ruleData) {
                        if (err) {
                            common.report(err);
                            return;
                        }

                        var startupWatchInput = {
                            InstanceId: eventBody.state.instance.InstanceId,
                            spotInstanceRequestId: eventBody.state.spotInstanceRequestId
                        };

                        cloudwatchevents.putTargets(
                            {
                                Rule: "cloudrig-startup-watch",
                                Targets: [
                                    {
                                        Arn: "arn:aws:sns:" +
                                            eventBody.config.AWSRegion + ":" +
                                            eventBody.settings.UserID + ":cloudrig-deleteRequestAndInstance",
                                        Input: JSON.stringify(startupWatchInput),
                                        Id: "1"
                                    }
                                ]
                            },
                            function (err) {
                                if (err) {
                                    common.report(err);
                                    return;
                                }

                                common.report("CloudRig spot instance successfully requested")
                                common.triggerNextLambda(lambdaARNQueue, eventBody);
                            }
                        );
                    }
                );

            }
        );
    }

    // Disable the schedulelambda rule, since it might have been enabled to
    // trigger this lambda
    cloudwatchevents.disableRule({ Name: "ScheduleLambda" },
        function (err, data) {
            if (err) {
                common.report(err);
            }

            run();

        });

}