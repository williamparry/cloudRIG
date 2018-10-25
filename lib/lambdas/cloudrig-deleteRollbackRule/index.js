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

        common.report("Deleting startup interruption rule");
        cloudwatchevents.removeTargets(
            {
                Rule: "cloudrig-startup-watch",
                Ids: ["1"]
            },
            function (err, data) {
                cloudwatchevents.deleteRule({
                    Name: "cloudrig-startup-watch"
                },
                    function (err, data) {
                        if (err) {
                            common.report(err);
                            return;
                        }
                        common.triggerNextLambda(lambdaARNQueue, eventBody);
                    });
            });
    }


    run();

}