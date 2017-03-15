# CloudRig

**Only tested on Mac so far**

**Don't forget to turn it off**

![Image of CloudRig boot screen](http://i.imgur.com/vvTtmw6.png)

## Setup

### ZeroTier

1. Visit [ZeroTier](https://www.zerotier.com/) and sign up
2. Go to [My ZeroTier](https://my.zerotier.com) and log in
3. Find **API Access Tokens**
    * Make a note of it, you will need it for the first run

cloudrig will offer to make a VPN for you using the API, and handle the joining and disconnecting.

### AWS

* You can use your existing credentials if you want, or make an IAM user
* Use the [shared credentials file](http://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/loading-node-credentials-shared.html)
    * Make a note of it, you will need it for the first run

cloudrig will offer to set up all the AWS infrastructure needed for cloudrig. You will be asked to confirm each step.

## To install and run

    $ start

## To run in maintenance mode

    cd cloudrig-cli
    node app -m