**Looking for maintainers. Please get in touch if you'd like to get involved.**

# cloudRIG

cloudRIG is the cheapest way to use AWS + Parsec for game and other application streaming. When configured, it will set up the requisite AWS infrastructure for you to boot spot instances preloaded with Parsec.

This is a community project that uses [Parsec](https://parsecgaming.com/) technology.

## Features

* Stream games and applications for <small>approx.</small> $0.13/hr
* Schedule shut down for the end of the current billing hour (AWS charges by the hour)
* 2 minute termination warning overlay
* Auto-saves your rig when you stop or are booted off
* Attach, extend a separate game drive
* Choose either g2.2xlarge, g3s.xlarge, or g3.4xlarge instance types

There are 2 ways to use cloudRIG: [GUI](#gui) or [CLI](#cli).

---

**Note:** I STRONGLY recommend you use a dedicated AWS account for cloudRIG as described [here](https://github.com/cloudrig/cloudRIG/wiki/AWS-Testing#setting-up-a-test-account).

---

## [GUI](https://github.com/cloudrig/cloudRIG/tree/master/gui)

### [Releases](https://github.com/cloudrig/cloudRIG/releases)

### Screenshots

![Welcome screen](https://user-images.githubusercontent.com/348091/42406162-814bc76a-81e5-11e8-800d-84fb5e84a413.png)
![Configuration Screen](https://user-images.githubusercontent.com/348091/42406163-817fb4d0-81e5-11e8-979f-1918732aca61.png)
![Initialization Screen](https://user-images.githubusercontent.com/348091/42406160-80e67fea-81e5-11e8-9c81-31cb07548666.png)
![AWS setup Screen](https://user-images.githubusercontent.com/348091/42418364-18d057c0-82e2-11e8-9877-c58a3120c0dd.png)
![Play Screen](https://user-images.githubusercontent.com/348091/42418357-ef8cd33e-82e1-11e8-838c-087e5422c0d5.png)

## [CLI](https://github.com/cloudrig/cloudRIG/tree/master/cli)

Not guaranteed to be up-to-date with the lib, but handy for sending SSM commands.

### Screenshots

![cloudRIG boot screen](https://user-images.githubusercontent.com/348091/31599523-1df1ff3e-b253-11e7-9afc-22b37d4cec04.png)

**Don't forget to turn it off when you're done gaming!**

## Required

### Parsec

* Make a Parsec account
* Download the Parsec client
* [Get the self-hosting key](https://parsecgaming.com/server-key)

<pre>:server_key=&lt;key&gt;:</pre>

### AWS

* You can use your existing credentials if you want, or make an IAM user with Administrator privileges. This is so that cloudRIG can make the requisite AWS infrastructure.
* Use the [shared credentials file](http://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/loading-node-credentials-shared.html)
    * Make a note of it, you will need it for the first run

cloudRIG will offer to set up all the AWS infrastructure needed for cloudrig. You will be asked to confirm each step.

### Software

* NodeJS

## Notice

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
