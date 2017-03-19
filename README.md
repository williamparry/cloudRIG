# CloudRig

**Only tested on Mac so far**

**Don't forget to turn it off**

![Image of CloudRig boot screen](http://i.imgur.com/vvTtmw6.png)

**Note:** Steam must be loaded from an initial boot. There is a bug whereby if you open, close and then reopen steam it fails to bind the requisite port (27036) for streaming. Pretty rubbish, really.

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

## Running

    node app [-m]

m = maintenance mode

## Maintenance mode

If you're tinkering with IAM roles you can use maintenance mode to clear out old instance profiles.

# Attempts at optimising AWS

* A user should be able to remote into their machine
* A user should not have to log in each time (it should remember them)
* A user should be able to install their games and have them persist

The original approach of making a new AMI each time kind of worked but it meant that if you wanted to retrieve the password for the box you couldn't (it wasn't the original AMI). This meant that the user would have to remember the password and automatically logging in with RDP wouldn't work.

1. Using snapshots

Could not mount as primary drive so tried to mount it as secondary drive, use PowerShell to make it online (because of collision) and then use the registry to swap C: and E: around (E being the snapshotted volume). The first couple of commands worked but setting the registry didn't persist.

2. Using a fixed EBS volume and symlinking the Steam and My Games folder

Set hard links "mklink /J souce dest" but it did not persist steam login (even though looked through config). Looks as though there are registry entries. Messing around with registry copying etc probably wouldn't end well.

One option is to write a batch script that generates a shortcut to steam that has the username and password set as flags, but that would mean storing the creds in their EBS volume.

## Solution

1. Copy base AMI
2. Get password using KeyPair
3. Use KMS to encrypt password and store in the user profile .cloudrig folder
4. Update AMI and tag (option to delete previous unless base)
5. Boot up cloudrig
6. Use KMS to decrypt password (KeyPair now redundant since not using base AMI)