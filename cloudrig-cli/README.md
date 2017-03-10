# DIY Cloudrig CLI

**Note:** Steam must be loaded from an initial boot. There is a bug whereby if you open, close and then reopen steam it fails to bind the requisite port (27036) for streaming. Pretty rubbish, really.

## Setup

### ZeroTier

1. Visit [ZeroTier](https://www.zerotier.com/) and sign up
2. Go to [My ZeroTier](https://my.zerotier.com) and log in
3. Find **API Access Tokens** and make a note of it, you will need it for the first run

cloudrig will offer to make a VPN for you using the API, and handle the joining and disconnecting.

### AWS

1. You can use your existing credentials if you want, or make an IAM user
2. Make a note of it, you will need it for the first run

cloudrig will offer to set up all the AWS infrastructure needed for cloudrig. You will be asked to confirm each step.

## Running

    node app [-m]

m = maintenance mode

## Maintenance mode

If you're tinkering with IAM roles you can use maintenance mode to clear out old instance profiles.