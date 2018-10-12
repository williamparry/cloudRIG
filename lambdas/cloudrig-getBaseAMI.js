exports.handler = (event, context, callback) => {
    var AWS = require("aws-sdk");
    var ec2 = new AWS.EC2();
    var sns = new AWS.SNS();
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
        ec2.describeImages(
            {
                Filters: [
                    {
                        Name: "name",
                        Values: ["parsec-g2-*"] // TODO: Make this dynamic depending on type of cloudrig
                    }
                ]
            },
            (err, data) => {
                if (err) {
                    console.log(err);
                    return;
                }

                if (!eventBody.state) {
                    eventBody.state = {};
                }
                eventBody.state.ImageId = data.Images[0].ImageId;

                triggerNextLambda();
            }
        );
    }

    cloudwatchevents.disableRule({ Name: "ScheduleLambda" },
        function (err, data) {
            if (err) {
                console.log(err);
            }

            run();
        });

};

