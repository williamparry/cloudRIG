# cloudRIG

[Powered by Parsec](https://parsec.tv), but there is an old [ZeroTier + Steam Home Streaming branch](https://github.com/williamparry/cloudRIG/tree/zerotier-steamstreaming)

---

**Note:** I STRONGLY recommend you use a dedicated AWS account for cloudRIG as described [here](https://github.com/williamparry/cloudRIG/wiki/AWS-Testing#setting-up-a-test-account).

---

**GUI Status**

<img alt="Travis CI status" src="https://travis-ci.org/williamparry/cloudRIG.svg?branch=master">

## Features

* Play using Parsec for around $0.10c / hour
* Schedule shut down for the end of the current billing hour (AWS charges by the hour)
* Auto-saves your rig when you stop or are booted off

## Cost

You set the maximum price you're willing to pay and cloudRIG will find the cheapest Availability Zone for your region, which is cheaper.

You will also have a separate EBS volume for storing games, which is around $10/month ([check for your region](https://calculator.s3.amazonaws.com/index.html))

**Don't forget to turn it off when you're done gaming!**

## Required

### Parsec

* Make a Parsec account
* Download the Parsec client
* [Get the self-hosting key](https://parsec.tv/add-computer/own)

![click on 'click here to see extra steps' and then in the element that appears, find the server_key](https://user-images.githubusercontent.com/348091/32673294-ef117400-c64e-11e7-949f-a34344b1368e.jpg)

### AWS

* You can use your existing credentials if you want, or make an IAM user with Administrator privileges. This is so that cloudRIG can make the requisite AWS infrastructure.
* Use the [shared credentials file](http://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/loading-node-credentials-shared.html)
    * Make a note of it, you will need it for the first run

cloudRIG will offer to set up all the AWS infrastructure needed for cloudrig. You will be asked to confirm each step.

### Software

* NodeJS

## Notice

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
