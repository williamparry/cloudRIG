exports.handler = (event, context, callback) => {

    var commonlib = require("cloudrigLambdaCommon");
    var common;
    var AWS = require("aws-sdk");
    var cloudwatchlogs = new AWS.CloudWatchLogs()
    var ec2 = new AWS.EC2();
    var sns = new AWS.SNS();
    var cloudwatchevents = new AWS.CloudWatchEvents();
    var eventBody = event;

    var snsArnPrefix = "arn:aws:sns:" +
        eventBody.config.AWSRegion + ":" +
        eventBody.settings.UserID + ":";

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
        },
        processEBSVolume: {
            arn: snsArnPrefix + "cloudrig-sendMessage",
            args: "Resize-Drive.ps1"
        },
        clearPreviousScheduledTasks: {
            arn: snsArnPrefix + "cloudrig-sendMessage",
            args: "Cancel-Scheduled-Shutdown.ps1"
        }
    };

    function startFromBase() {
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
        common.report("Making your cloudRIG! This happens once and may take a while.");
    }

    function loadExistingCloudrig() {
        lambdaARNQueue.push(lambdaData.checkSpotPrice);
        lambdaARNQueue.push(lambdaData.request);
        lambdaARNQueue.push(lambdaData.waitForInstanceOk);
        lambdaARNQueue.push(lambdaData.waitForSSM);
        lambdaARNQueue.push(lambdaData.attachEBSVolume);
        lambdaARNQueue.push(lambdaData.processEBSVolume);
        lambdaARNQueue.push(lambdaData.reboot);
        lambdaARNQueue.push(lambdaData.clearPreviousScheduledTasks);
        lambdaARNQueue.push(lambdaData.createShutdownNotifier);
        lambdaARNQueue.push(lambdaData.createTerminationChecker);
        lambdaARNQueue.push(lambdaData.scheduleReset);
        lambdaARNQueue.push(lambdaData.addTerminationChecker);
        lambdaARNQueue.push(lambdaData.createCloudWatchEvent);
        lambdaARNQueue.push(lambdaData.deleteRollbackRule);
        common.report("Starting your last cloudRIG");
    }

    function setupLogGroup(cb) {
        cloudwatchlogs.createLogGroup(
            {
                logGroupName: "cloudrig-logs"
            },
            function (err, data) {

                eventBody.logStreamName = "cloudrig-start-" + Date.now();
                cloudwatchlogs.createLogStream(
                    {
                        logGroupName: "cloudrig-logs",
                        logStreamName: eventBody.logStreamName
                    },
                    function (err, data) {
                        common = new commonlib(eventBody);
                        cb();
                    });
            });
    }


    function run() {
        common.report("Finding AMI");

        ec2.describeImages(
            {
                Owners: ["self"],
                Filters: common.standardFilter
            },
            function (err, data) {
                if (err) {
                    common.report(err);
                    return;
                }

                if (data.Images[0]) {

                    if (!eventBody.state) {
                        eventBody.state = {};
                    }
                    eventBody.state.ImageId = data.Images[0].ImageId;

                    loadExistingCloudrig();
                }
                else {
                    startFromBase();
                }

                common.triggerNextLambda(lambdaARNQueue, eventBody);
            }
        );
    }


    var lambdaARNQueue = [];


    ec2.describeInstances(
        {
            Filters: common.standardFilter.concat([
                {
                    Name: "instance-state-name",
                    Values: ["stopping"]
                }
            ])
        },
        function (err, data) {
            if (err) {
                common.report(err);
                return;
            }

            if (data.Reservations[0]
                && data.Reservations[0].Instances
                && data.Reservations[0].Instances.length > 0) {
                common.report("cloudRIG is currently stopping, try again later.");
                return;
            }

            cloudwatchevents.listRules(
                {
                    NamePrefix: common.cloudWatchSavePrefix + "-"
                },
                function (err, data) {
                    if (err) {
                        common.report(err);
                        return;
                    }

                    if (data.Rules[0]) {
                        common.report("cloudRIG is currently saving, try again later.");
                        return;
                    }

                    run();

                }
            );
        }
    );




}