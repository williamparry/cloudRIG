var fs = require("fs-extra");
var async = require("async");
var archiver = require("archiver");
var tmp = require("tmp");
var AWS = require("aws-sdk");
AWS.config.region = "ap-southeast-2"
var sns = new AWS.SNS();
var lambda = new AWS.Lambda();
const { exec } = require("child_process");


var lambdaDirs = [];
var userId ="fillthisin";
var AWSRegion = "fillthisin"; // Fill these in before running

// Update each lambda in the lambdas folder (folders starting with "cloudrig-")
async.eachLimit(fs.readdirSync("../"),1,
    (folderName, cb) => {
        if (folderName.substring(0, 9) == "cloudrig-") {

            console.log(`Updating ${folderName}`)

            var timeout = 60;
            if (folderName == "cloudrig-waitForInstanceOk") {
                timeout = 150;
            }

            async.series([
                cb => {
                    // Delete all dependencies
                    fs.remove(`../${folderName}/node_modules`, (err, data) => {
                        cb();
                    })
                },
                cb => {
                    // Install dependencies
                    exec(`cd ../${folderName} && yarn install`, (err, data) => {
                        cb();
                    })
                },
                cb => {
                    // Create zip
                    var archive = archiver('zip', { zlib: { level: 9 } });
                    var fileOutput = fs.createWriteStream(`${folderName}.zip`);
                    archive.pipe(fileOutput);
                    archive.directory(`../${folderName}`, false);
                    archive.finalize();

                    // Delete function if it already exists (ignore error if it doesn't)
                    lambda.deleteFunction({ FunctionName: folderName }, (err, data) => {
                        
                        cb();
                    })
                },
                cb => {
                    // Upload function
                    lambda.createFunction(
                        {
                            Code: { ZipFile: fs.readFileSync(`${folderName}.zip`) },
                            Description: "",
                            FunctionName: folderName,
                            Handler: "index.handler",
                            MemorySize: 128,
                            Publish: true,
                            Role: `arn:aws:iam::${userId}:role/cloudrig-role`,
                            Runtime: "nodejs6.10",
                            Timeout: timeout,
                            VpcConfig: {}
                        },
                        (err, data) => {
                            if (err){
                                console.log(folderName)
                                console.log(err);
                            }
                            // Delete zip
                            fs.unlinkSync(`${folderName}.zip`);
                            cb();
                        });
                },
                cb => {
                    // Delete topic
                    sns.deleteTopic(
                        {
                            TopicArn: `arn:aws:sns:${AWSRegion}:${userId}:${folderName}`
                        }, (err, data) => {
                            cb();
                        });
                },
                cb => {
                    // Create topic
                    sns.createTopic(
                        {
                            Name: folderName
                        }, (err, data) => {
                            cb();
                        });
                },
                cb => {
                    // Create subscription
                    sns.subscribe(
                        {
                            Protocol: "lambda",
                            TopicArn: `arn:aws:sns:${AWSRegion}:${userId}:${folderName}`,
                            Endpoint: `arn:aws:lambda:${AWSRegion}:${userId}:function:${folderName}`
                        }, (err, data) => {
                            cb();
                        })
                },
                cb => {
                    // Add policy
                    sns.setTopicAttributes(
                        {
                            TopicArn: `arn:aws:sns:${AWSRegion}:${userId}:${folderName}`,
                            AttributeName: "Policy",
                            AttributeValue: `{
                                "Version": "2012-10-17",
                                "Id": "__default_policy_ID",
                                "Statement": [
                                  {
                                    "Sid": "__default_statement_ID",
                                    "Effect": "Allow",
                                    "Principal": {
                                      "AWS": "*"
                                    },
                                    "Action": [
                                      "SNS:GetTopicAttributes",
                                      "SNS:SetTopicAttributes",
                                      "SNS:AddPermission",
                                      "SNS:RemovePermission",
                                      "SNS:DeleteTopic",
                                      "SNS:Subscribe",
                                      "SNS:ListSubscriptionsByTopic",
                                      "SNS:Publish",
                                      "SNS:Receive"
                                    ],
                                    "Resource": "arn:aws:sns:${AWSRegion}:${userId}:${folderName}",
                                    "Condition": {
                                      "StringEquals": {
                                        "AWS:SourceOwner": "${userId}"
                                      }
                                    }
                                  },
                                  {
                                    "Sid": "AWSEvents_ScheduleLambda_scheduled",
                                    "Effect": "Allow",
                                    "Principal": {
                                      "Service": "events.amazonaws.com"
                                    },
                                    "Action": "sns:Publish",
                                    "Resource": "arn:aws:sns:${AWSRegion}:${userId}:${folderName}"
                                  }
                                ]
                              }`

                        }, (err, data) => {
                            cb();
                        });
                },
                cb => {
                    // Add permission
                    lambda.addPermission(
                        {
                            Action: "lambda:InvokeFunction",
                            FunctionName: folderName,
                            Principal: "sns.amazonaws.com",
                            StatementId: "sns_lambda",
                            SourceArn: `arn:aws:sns:${AWSRegion}:${userId}:${folderName}`
                        }, (err, data) => {
                            cb();
                        });
                }
            ],
                (err, data) => {
                    cb();
                });
        }
        else {
            cb();
        }
    },
    (err, data) => {
        console.log("Done");
    });
