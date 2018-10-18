exports.handler = (event, context, callback) => {

    var common = require("cloudrigLambdaCommon");
    var AWS = require("aws-sdk");

    var sns = new AWS.SNS();
    var ec2 = new AWS.EC2();
    var cloudwatchevents = new AWS.CloudWatchEvents();


    var eventBody = JSON.parse(event.Records[0].Sns.Message);
    var lambdaARNQueue = eventBody.lambdaARNQueue;

    function run() {
        ec2.describeSpotPriceHistory(
            {
                AvailabilityZone: eventBody.config.AWSAvailabilityZone,
                MaxResults: 1,
                InstanceTypes: [eventBody.config.AWSInstanceType],
                ProductDescriptions: ["Windows"]
            },
            function (err, data) {
                if (err) {
                    common.report(err);
                    return;
                }


                if (!eventBody.state) {
                    eventBody.state = {};
                }
                eventBody.state.availabilityZone = eventBody.config.AWSAvailabilityZone;

                common.report(
                    "Spot price for your zone " +
                    eventBody.state.availabilityZone +
                    " is $" +
                    data.SpotPriceHistory[0].SpotPrice +
                    " / Max price: $" +
                    eventBody.config.AWSMaxPrice
                );

                if (
                    parseFloat(data.SpotPriceHistory[0].SpotPrice) >=
                    parseFloat(eventBody.config.AWSMaxPrice)
                ) {
                    common.report(
                        "Your max price is too low right now. Either wait for" +
                        "the cost to go down, or raise your max price"
                    );
                    return;
                }
                else {
                    common.triggerNextLambda(lambdaARNQueue, eventBody);
                }


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