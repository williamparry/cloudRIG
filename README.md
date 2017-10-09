# cloudRIG

This sets up a gaming computer on AWS for you to use with Steam Home Streaming. It sets up a g2.2xlarge spot instance on AWS and a VPN using ZeroTier.

cloudRIG manages the VPN and requisite AWS setup for you after you've configured it with your AWS credentials and ZeroTier API Key.

NOTE: There is a [version for Parsec](https://github.com/williamparry/cloudRIG/tree/parsec)

![cloudRIG boot screen](https://user-images.githubusercontent.com/348091/29874010-a503a848-8d95-11e7-8afb-b61ab34fc4ad.png)

![cloudRIG open screen](https://user-images.githubusercontent.com/348091/29967259-1b26157a-8f16-11e7-86c3-7354624c5c02.png)

## Features

* Sets up gaming rig from stock Windows 2016 image
* Choosest cheapest Availability Zone based on your region
* Auto-saves your rig when you stop or are booted off
* Configures VPN for you
* Administer using RDP in your browser

## History

This was built upon excellent work by these folks:

* https://nexus.vert.gg/gaming-on-amazon-s-ec2-83b178f47a34
* https://lg.io/2015/07/05/revised-and-much-faster-run-your-own-highend-cloud-gaming-service-on-ec2.html
* https://github.com/lg/cloudy-gamer

If cloudRIG doesn't do it for you, check out cloudy-gamer; a whole lot of the Powershell in cloudRIG is by the author of it.

## Cost

Pretty cheap. cloudRIG will find the cheapest Availability Zone for your region

There's the cost of storing the machine when it's off and maybe other costs involved, so just be careful and **don't forget to turn it off when you're done gaming!**

## Performance

Varies wildly. Check http://www.cloudping.info/ for the best region to use.

## Notice

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Setup

### ZeroTier

1. Visit [ZeroTier](https://www.zerotier.com/) and sign up
2. Go to [My ZeroTier](https://my.zerotier.com) and log in
3. Find **API Access Tokens**
    * Make a note of it, you will need it for the first run

cloudRIG will offer to make a VPN for you using the API, and handle the joining and disconnecting.

### AWS

* You can use your existing credentials if you want, or make an IAM user with Administrator privileges. This is so that cloudRIG can make the requisite AWS infrastructure.
* Use the [shared credentials file](http://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/loading-node-credentials-shared.html)
    * Make a note of it, you will need it for the first run
* You will need to apply for the EC2 g2.2xlarge instance type limit increase. Only takes a minute.

cloudRIG will offer to set up all the AWS infrastructure needed for cloudrig. You will be asked to confirm each step.

### Running

    npm install
    node index

### Errors

You may see on the first boot an error:

> You have requested more instances (1) than your current instance limit of 0 allows for the specified instance type. Please visit http://aws.amazon.com/contact-us/ec2-request to request an adjustment to this limit.

Just follow those instructions and try again afterwards.
