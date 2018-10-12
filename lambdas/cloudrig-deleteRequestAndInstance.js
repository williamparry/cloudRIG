exports.handler = (event, context, callback) => {
    var AWS = require("aws-sdk");
    var ec2 = new AWS.EC2();
    var cloudwatchevents = new AWS.CloudWatchEvents();

    function run() {
        console.log("Tagging spot instance " + event.InstanceId + " as cancelled");
        ec2.createTags({
            Resources: [event.InstanceId],
            Tags: [
                {
                    Key: "cancelled",
                    Value: "true"
                }
            ]
        },
            function (err, data) {
                if (err) {
                    console.log(err);
                }

                console.log("Terminating spot instance " + event.InstanceId);
                ec2.terminateInstances(
                    {
                        InstanceIds: [event.InstanceId]
                    },
                    function (err, data) {
                        if (err) {
                            console.log(err);
                        }

                        console.log("Deleting spot request " + event.spotInstanceRequestId);
                        ec2.cancelSpotInstanceRequests(
                            {
                                SpotInstanceRequestIds: [event.spotInstanceRequestId]
                            },
                            function (err, data) {
                                if (err) {
                                    console.log(err);
                                    return;
                                }

                                cloudwatchevents.deleteRule({
                                    Name: "cloudrig-startup-watch"
                                },
                                    function (err, data) {
                                        if (err) {
                                            console.log(err);
                                            return;
                                        }
                                    });
                            }
                        );
                    }
                );


            });
    }


    run();
};

