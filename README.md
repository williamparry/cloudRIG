# cloudRIG

[Powered by Parsec](https://parsec.tv)

## Features

* Play using Parsec for around $0.10c / hour
* Auto-saves your rig when you stop or are booted off

## Cost

You set the maximum price you're willing to pay and cloudRIG will find the cheapest Availability Zone for your region, which is cheaper.

You will also have a separate EBS volume for storing games, which is around $10/month ([check for your region](https://calculator.s3.amazonaws.com/index.html))

**Don't forget to turn it off when you're done gaming!**

## Setup

### Parsec

* Make a Parsec account
* Download the Parsec client
* Get the self-hosting key

### AWS

* You can use your existing credentials if you want, or make an IAM user with Administrator privileges. This is so that cloudRIG can make the requisite AWS infrastructure.
* Use the [shared credentials file](http://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/loading-node-credentials-shared.html)
    * Make a note of it, you will need it for the first run

cloudRIG will offer to set up all the AWS infrastructure needed for cloudrig. You will be asked to confirm each step.

### Running

    npm install
    node index

## Notice

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.