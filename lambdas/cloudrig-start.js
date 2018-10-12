// Gets state data about all existing cloudrigs
exports.handler = (event, context, callback) => {

    var AWS = require("aws-sdk");

    var ec2 = new AWS.EC2();
    var sns = new AWS.SNS();

    var eventBody = event;

    var snsArnPrefix = "arn:aws:sns:ap-southeast-2:703028140084:"

    // Push any members of this tuple to lambdaARNQueue to add them to the invocation pipeline
    var lambdaData = {
        getBaseAMI: {
            arn: snsArnPrefix + "cloudrig-getBaseAMI",
            args: ""
        },
        checkSpotPrice: {
            arn: snsArnPrefix + "cloudrig-checkSpotPrice",
            args: ""
        },
        request: {
            arn: snsArnPrefix + "cloudrig-request",
            args: ""
        },
        waitForInstanceOk: {
            arn: snsArnPrefix + "cloudrig-waitForInstanceOk",
            args: ""
        },
        waitForSSM: {
            arn: snsArnPrefix + "cloudrig-waitForSSM",
            args: ""
        },
        attachEBSVolume: {
            arn: snsArnPrefix + "cloudrig-attachEBSVolume",
            args: ""
        },
        installFolders: {
            arn: snsArnPrefix + "cloudrig-sendMessage",
            args: "Install-Folders.ps1"
        },
        createShutdownNotifier: {
            arn: snsArnPrefix + "cloudrig-sendMessage",
            args: "Create-Shutdown-Notification.ps1"
        },
        createTerminationChecker: {
            arn: snsArnPrefix + "cloudrig-sendMessage",
            args: "Create-Termination-Checker.ps1"
        },
        initialiseDrive: {
            arn: snsArnPrefix + "cloudrig-sendMessage",
            args: "Set-Drive.ps1"
        },
        reboot: {
            arn: snsArnPrefix + "cloudrig-reboot",
            args: ""
        },
        scheduleReset: {
            arn: snsArnPrefix + "cloudrig-sendMessage",
            args: "Schedule-Reset.ps1"
        },
        createCloudWatchEvent: {
            arn: snsArnPrefix + "cloudrig-createCloudWatchEvent",
            args: ""
        },
        addTerminationChecker: {
            arn: snsArnPrefix + "cloudrig-sendMessage",
            args: "Schedule-Termination-Checker.ps1"
        },
        deleteRollbackRule: {
            arn: snsArnPrefix + "cloudrig-deleteRollbackRule",
            args: ""
        }
    };

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




    var lambdaARNQueue = [];

    lambdaARNQueue.push(lambdaData.getBaseAMI);
    lambdaARNQueue.push(lambdaData.checkSpotPrice);
    lambdaARNQueue.push(lambdaData.request);
    lambdaARNQueue.push(lambdaData.waitForInstanceOk);
    lambdaARNQueue.push(lambdaData.waitForSSM);
    lambdaARNQueue.push(lambdaData.attachEBSVolume);
    lambdaARNQueue.push(lambdaData.installFolders);
    lambdaARNQueue.push(lambdaData.createShutdownNotifier);
    lambdaARNQueue.push(lambdaData.createTerminationChecker);
    lambdaARNQueue.push(lambdaData.initialiseDrive);
    lambdaARNQueue.push(lambdaData.reboot);
    lambdaARNQueue.push(lambdaData.scheduleReset);
    lambdaARNQueue.push(lambdaData.createCloudWatchEvent);
    lambdaARNQueue.push(lambdaData.addTerminationChecker);
    lambdaARNQueue.push(lambdaData.deleteRollbackRule);

    console.log("Making your cloudRIG! This happens once and may take a while.");
    triggerNextLambda();


};
