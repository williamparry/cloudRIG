exports.handler = (event, context, callback) => {

    var common = require("cloudrigLambdaCommon");
    var AWS = require("aws-sdk");
    var sns = new AWS.SNS();
    var ec2 = new AWS.EC2();
    var cloudwatchevents = new AWS.CloudWatchEvents();


    var eventBody = JSON.parse(event.Records[0].Sns.Message);
    var lambdaARNQueue = eventBody.lambdaARNQueue;

    
    function run() {
        console.log("Rebooting cloudrig instance");

        ec2.rebootInstances(
            {
                InstanceIds: [eventBody.state.instance.InstanceId]
            },
            function (err, data) {
                if (err) {
                    common.report(err);
                    return;
                }
                common.scheduleNextLambda("1 minute", lambdaARNQueue, eventBody);
            }
        );
    }

    common.start(run, eventBody);

}