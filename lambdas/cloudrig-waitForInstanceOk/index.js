exports.handler = (event, context, callback) => {

    var common = require("cloudrigLambdaCommon");
    var AWS = require("aws-sdk");
    var sns = new AWS.SNS();
    var ec2 = new AWS.EC2();
    var cloudwatchevents = new AWS.CloudWatchEvents();


    var eventBody = JSON.parse(event.Records[0].Sns.Message);
    var lambdaARNQueue = eventBody.lambdaARNQueue;


    function run() {
        ec2.waitFor(
            /* Assuming instanceOk doesn't take long to happen, 
            * otherwise this needs to be changed to a cloudwatch rule,
            * lambda function will timeout if takes too long.
            */
            "instanceStatusOk",
            {
                InstanceIds: [eventBody.state.instance.InstanceId]
            },
            function (err, data) {
                if (err) {
                    common.report(err);
                    return;
                }
                triggerNextLambda(lambdaARNQueue, eventBody)
            }
        );
    }

    common.start(run, eventBody);



}