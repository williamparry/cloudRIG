var async = require("async");
var AWS = require("aws-sdk");
AWS.config.region = "ap-southeast-2"
var cloudwatchlogs = new AWS.CloudWatchLogs();

var startTime = "1540137818670";
var startPattern = `[cloudrigrun${startTime}]`;

var seenEventIds = [];

var groups = [
    "/aws/lambda/cloudrig-deleteRequestAndInstance",
    "/aws/lambda/cloudrig-deleteRollbackRule",
    "/aws/lambda/cloudrig-createCloudWatchEvent",
    "/aws/lambda/cloudrig-reboot",
    "/aws/lambda/cloudrig-checkMessageSuccess",
    "/aws/lambda/cloudrig-sendMessage",
    "/aws/lambda/cloudrig-attachEBSVolume",
    "/aws/lambda/cloudrig-waitSSM",
    "/aws/lambda/cloudrig-waitForInstanceOk",
    "/aws/lambda/cloudrig-request",
    "/aws/lambda/cloudrig-checkSpotPrice",
    "/aws/lambda/cloudrig-getBaseAMI",
    "/aws/lambda/cloudrig-start"       
];
var complete = false;



function check() {

    var sortArray = [];

    async.eachLimit(groups, 1, (group, cb) => {
        cloudwatchlogs.filterLogEvents({
            logGroupName: group,
            filterPattern: `"${startPattern}"`
        }, function (err, data) {
            
            if (data) {
                if (data.events) {
                    data.events.forEach(event => {
                        if (!seenEventIds.includes(event.eventId)) {
                            seenEventIds.push(event.eventId);
                            let message = event.message.substring(event.message.
                                lastIndexOf(startPattern) + startPattern.length);

                            sortArray.push(
                                {
                                    timestamp: event.timestamp,
                                    message: message.substr(2, message.length - 4)
                                }
                            );
                        }
                    });
                    
                }
            }
            cb();

        })
    }, () => {
        var sorted = sortArray.sort((a, b) => {
            if (a.timestamp == b.timestamp) {
                return 0;
            }
            else if (a.timestamp > b.timestamp) {
                return 1;
            }
            else {
                return -1;
            }
        }).forEach(event => {
            console.log(event.message);
            if (event.message == "No more functions in lambda queue") {
                complete = true;
            }
        });
    })


    if (!complete) {
        setTimeout(check, 10000);
    }

}

check();