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
        ec2.describeSpotPriceHistory(
            {
                AvailabilityZone: eventBody.config.AWSAvailabilityZone,
                MaxResults: 1,
                InstanceTypes: [eventBody.config.AWSInstanceType],
                ProductDescriptions: ["Windows"]
            },
            function(err,data) {
                if (err) {
                    console.log(err);
                    return;
                }
                
                
                if (!eventBody.state) {
                    eventBody.state = {};
                }
                eventBody.state.availabilityZone = eventBody.config.AWSAvailabilityZone;
                
                console.log(
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
                    console.log(
                        "Your max price is too low right now. Either wait for" +
                        "the cost to go down, or raise your max price"
                        );
                    return;
                }
                else {
                    triggerNextLambda();
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

            run();

        });

};

