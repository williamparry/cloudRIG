# cloudRIG

This sets up a gaming computer on AWS for you to use with Steam Home Streaming. It sets up a g2.2xlarge on-demand instance on AWS and a VPN using ZeroTier.

cloudRIG manages the VPN and requisite AWS setup for you after you've configured it with your AWS credentials and ZeroTier API Key.

## History

This was built upon excellent work here by these folks:

* https://nexus.vert.gg/gaming-on-amazon-s-ec2-83b178f47a34
* https://lg.io/2015/07/05/revised-and-much-faster-run-your-own-highend-cloud-gaming-service-on-ec2.html
* https://github.com/lg/cloudy-gamer

## Cost

Originally cloudRIG was built to use AWS Spot Fleet instances, but the price was consistently too high so I changed it to be on-demand with a more stable $1USD/hr-ish (best to check beforehand).

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

* You can use your existing credentials if you want, or make an IAM user
* Use the [shared credentials file](http://docs.aws.amazon.com/sdk-for-javascript/v2/developer-guide/loading-node-credentials-shared.html)
    * Make a note of it, you will need it for the first run
* You will need to apply for the EC2 g2.2xlarge instance type limit increase. Only takes a minute.

cloudRIG will offer to set up all the AWS infrastructure needed for cloudrig. You will be asked to confirm each step.