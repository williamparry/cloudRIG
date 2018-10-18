exports.handler = (event, context, callback) => {

    var common = require("cloudrigLambdaCommon");
    var AWS = require("aws-sdk");
    var sns = new AWS.SNS();
    var ec2 = new AWS.EC2();
    var cloudwatchevents = new AWS.CloudWatchEvents();


    var eventBody = JSON.parse(event.Records[0].Sns.Message);
    var lambdaARNQueue = eventBody.lambdaARNQueue;

    function run() {
        var fs = require("fs");
        var args = eventBody.args;
        var commands = fs.readFileSync("ps1/" + args).toString();
        var ssm = new AWS.SSM();

        commands = !Array.isArray(commands) ? [commands] : commands;


        common.report("Sending message: \"" + args + "\"");

        ssm.sendCommand({
            DocumentName: "AWS-RunPowerShellScript",
            InstanceIds: [eventBody.state.instance.InstanceId],
            Parameters: {
                commands: commands
            }
        },
            function (err, data) {
                if (err) {
                    common.report(err);
                    return;
                }

                var checkMessageSuccess = {
                    arn: "arn:aws:sns:" +
                        eventBody.config.AWSRegion + ":" +
                        eventBody.settings.UserID + "cloudrig-checkMessageSuccess",
                    args: data.Command.CommandId
                }
                lambdaARNQueue.unshift(checkMessageSuccess);
                triggerNextLambda();
            });
    }

    common.start(run, eventBody);

}