var AWS = require("aws-sdk");
var sns = new AWS.SNS();
var ec2 = new AWS.EC2();
var cloudwatchevents = new AWS.CloudWatchEvents();
var cloudwatchlogs = new AWS.CloudWatchLogs()

var standardFilter = [
    {
        Name: "tag:cloudrig",
        Values: ["true"]
    }
];
var cloudWatchSavePrefix = "cloudrig-save";

var storedInstanceId;
var storedSpotInstanceRequestId;
var storedAwsRegion;
var storeduserId;
var storedLogStreamName;


function Common(eventBody) {

    if (eventBody.state.instance && eventBody.state.spotInstanceRequestId) {
        this.storedInstanceId = eventBody.state.instance.InstanceId;
        this.storedSpotInstanceRequestId = eventBody.state.spotInstanceRequestId;
    }
    this.storedLogStreamName = eventBody.logStreamName;
    this.storedAwsRegion = eventBody.config.AWSRegion;
    this.storeduserId = eventBody.settings.UserID;
}


// Reporter, should send to cloudwatch
Common.prototype.report = function report(message) {

    console.log(message);

    cloudwatchlogs.describeLogStreams(
        {
            logGroupName: "cloudrig-logs",
            logStreamNamePrefix: this.storedLogStreamName
        },
        function (err, data) {

            cloudwatchlogs.putLogEvents({
                logEvents: [
                    {
                        message: message,
                        timestamp: Date.now()
                    }
                ],
                logGroupName: "cloudrig-logs",
                logStreamName: this.storedLogStreamName,
                sequenceToken: data.logStreams[0].uploadSequenceToken
            },
                function (err, data) { });
        });

}




Common.prototype.triggerRollback = function triggerRollback(message) {
    this.report("Triggering rollback, error encountered: ")
    this.report(message);

    var startupWatchInput = {
        InstanceId: this.storedInstanceId,
        spotInstanceRequestId: this.storedSpotInstanceRequestId
    };

    sns.publish({
        Message: JSON.stringify(startupWatchInput),
        TopicArn: "arn:aws:sns:" +
            this.storedAwsRegion + ":" +
            this.storeduserId + ":cloudrig-deleteRequestAndInstance"
    }
        , function (err, data) {
            if (err) {
                this.report(err);
            }
        });
}

// Trigger the next lambda in the queue
Common.prototype.triggerNextLambda = function triggerNextLambda(lambdaARNQueue, eventBody) {
    // Trigger next lambda in queue
    if (lambdaARNQueue.length == 0) {
        this.report("No more functions in lambda queue")
    }
    else {
        this.report("Triggering next lambda via SNS");

        var nextFunc = lambdaARNQueue.shift();
        eventBody.lambdaARNQueue = lambdaARNQueue;
        eventBody.args = nextFunc.args;

        this.report("ARN of SNS to be triggered is " + nextFunc.arn);
        this.report("Argument of lambda is" + nextFunc.args);

        sns.publish({
            Message: JSON.stringify(eventBody),
            TopicArn: nextFunc.arn
        }
            , function (err, data) {
                if (err) {
                    this.report(err);
                    return;
                }
                this.report(data);
            });
    }
}

// Trigger the next lambda in the queue after the specified delay (granularity 1 minute)
Common.prototype.scheduleNextLambda = function scheduleNextLambda(rate, lambdaARNQueue, eventBody) {
    // Trigger next lambda in queue
    if (lambdaARNQueue.length == 0) {
        this.report("No more functions in lambda queue")
    }
    else {
        this.report("Triggering next lambda via cloudwatch rule in "
            + rate);

        var nextFunc = lambdaARNQueue.shift();
        eventBody.lambdaARNQueue = lambdaARNQueue;
        eventBody.args = nextFunc.args;

        this.report("ARN of SNS to be triggered is " + nextFunc.arn);
        this.report("Argument of lambda is" + nextFunc.args);

        cloudwatchevents.putRule({
            Name: "ScheduleLambda",
            ScheduleExpression: "rate(" + rate + ")",
            State: "ENABLED"
        }, function (err, data) {
            if (err) {
                this.report(err);
                return;
            }

            cloudwatchevents.removeTargets({
                Ids: ["scheduled"],
                Rule: "ScheduleLambda"
            }, function (err, data) {
                if (err) {
                    this.report(err);
                    return;
                }

                cloudwatchevents.putTargets({
                    Rule: "ScheduleLambda",
                    Targets: [{
                        Arn: nextFunc.arn,
                        Input: JSON.stringify(eventBody),
                        Id: "scheduled"
                    }]
                },
                    function (err, data) {
                        if (err) {
                            this.report(err);
                            return;
                        }
                    })
            });

        });

    }
}

// Run the start functions for the lambda, then call the run callback 
// Should only be used after the request step (checks for instance)
Common.prototype.start = function start(runCB, eventBody) {
    // Disable the schedulelambda rule, since it might have been enabled to
    // trigger this lambda
    cloudwatchevents.disableRule({ Name: "ScheduleLambda" },
        function (err, data) {
            if (err) {
                this.report(err);
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
                        this.triggerRollback(err);
                        return;
                    }

                    if (data.Tags.some(function (tag) {
                        return tag.Key == "cancelled";
                    })) {
                        this.triggerRollback("Instance marked as cancelled");
                        return;
                    }

                    if (data.Tags.length == 0) { // Instance doesn't exist
                        this.triggerRollback("Instance not found");
                        return;
                    }

                    runCB();

                });
        });
}




module.exports = Common;