# cloudRIG

[Powered by Parsec](https://parsecgaming.com/).

cloudRIG is the cheapest way to use AWS + Parsec for game and other application streaming. When configured, it will set up the requisite AWS infrastructure for you to boot spot instances preloaded with Parsec.

## Features

* Stream games and applications for <small>approx.</small> $0.13/hr
* Schedule shut down for the end of the current billing hour (AWS charges by the hour)
* Auto-saves your rig when you stop or are booted off
* Add a drive for your games, which can be expanded and transferred across Availability Zones

There are 2 ways to use cloudRIG: [GUI](#gui) or [CLI](#cli).

---

**Note:** I STRONGLY recommend you use a dedicated AWS account for cloudRIG as described [here](https://github.com/williamparry/cloudRIG/wiki/AWS-Testing#setting-up-a-test-account).

---

## [GUI](https://github.com/williamparry/cloudRIG/tree/master/gui)

![Travis CI status](https://travis-ci.org/williamparry/cloudRIG.svg?branch=master)

### [Releases](https://github.com/williamparry/cloudRIG/releases)

### Screenshots

![Configuration Screen](https://user-images.githubusercontent.com/348091/32979619-fbe44170-cc58-11e7-9428-747dd3a0f9fb.png)
![Initialization Screen](https://user-images.githubusercontent.com/348091/32982361-59593b60-cc83-11e7-822a-f23320bec151.png)
![Play Screen](https://user-images.githubusercontent.com/348091/33514039-23bc3d34-d74d-11e7-93dc-7d7725efb743.png)
![Scheduled Stop](https://user-images.githubusercontent.com/348091/33574118-509dbe3a-d938-11e7-905f-476771a5a65f.png)

## [CLI](https://github.com/williamparry/cloudRIG/tree/master/cli)

Not guaranteed to be up-to-date with the lib, but handy for sending SSM commands.

### Screenshots

![cloudRIG boot screen](https://user-images.githubusercontent.com/348091/31599523-1df1ff3e-b253-11e7-9afc-22b37d4cec04.png)

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

## History

There is an old [ZeroTier + Steam Home Streaming branch](https://github.com/williamparry/cloudRIG/tree/zerotier-steamstreaming).

## Notice

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
