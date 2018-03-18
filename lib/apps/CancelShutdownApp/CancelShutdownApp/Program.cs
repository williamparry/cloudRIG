using System;
using Windows.UI.Notifications;
using Windows.Data.Xml.Dom;
using Windows.Foundation;
using Microsoft.Win32;
using System.Timers;
using Amazon.CloudWatchEvents;
using Amazon.CloudWatchEvents.Model;
using System.Reflection;
using System.IO;

namespace CancelShutdownApp
{
    class Program
    {
        private static string APP_ID = "8446f277-7064-44c4-b702-360fcf67e412";
        private static String cloudStopRule;
        private static String cloudNotifyRule;
        private static int minutes = 50;
        private static Timer timer = new Timer();
        private static XmlDocument toastXml = new XmlDocument();
        private static AmazonCloudWatchEventsClient cloudWatchClient = new AmazonCloudWatchEventsClient();
        static void Main(string[] args)
        {
            if (args.Length < 3)
            {
                System.Environment.Exit(1);
            }
            cloudStopRule = args[0];
            cloudNotifyRule = args[1];
            minutes = Int32.Parse(args[2]);
            // Get a toast XML template
            System.Xml.XmlDocument xmlDoc = new System.Xml.XmlDocument();
            xmlDoc.Load(GetExecutingDirectory() + "\\xml\\toast.xml");
            toastXml.LoadXml(xmlDoc.InnerXml);
            // Create the toast and attach event listeners
            changeXMLAndSendToast();
            timer.Interval = 60000;
            timer.Enabled = true;
            timer.AutoReset = true;
            timer.Elapsed += changeTime;
            timer.Start();
            while (true)
            {
                Console.ReadLine();
            }
        }
        private static void ToastActivated(ToastNotification sender, object e)
        {
            PropertyInfo[] propInfoArgs = e.GetType().GetProperties();
            foreach (PropertyInfo descriptor in propInfoArgs)
            {
                string name = descriptor.Name;
                object value = descriptor.GetValue(e);
                if (name.Equals("Arguments") && value.ToString().Equals("cancelShutdown"))
                {
                    timer.Stop();
                    Console.WriteLine("Trying to cancel a shutdown!");
                    // delete targets
                    RemoveTargetsRequest removeTargetsRequest = new RemoveTargetsRequest
                    {
                        Rule = cloudStopRule,
                        Ids = new System.Collections.Generic.List<string> { "2" }

                    };
                    RemoveTargetsResponse removeTargetsResponse = cloudWatchClient.RemoveTargets(removeTargetsRequest);
                    Console.WriteLine("Code = " + removeTargetsResponse.HttpStatusCode);
                    removeTargetsRequest.Rule = cloudNotifyRule;
                    removeTargetsRequest.Ids = new System.Collections.Generic.List<string> { "3" };
                    removeTargetsResponse = cloudWatchClient.RemoveTargets(removeTargetsRequest);
                    Console.WriteLine("Code = " + removeTargetsResponse.HttpStatusCode);
                    // delete rules
                    DeleteRuleRequest deleteRuleRequest = new DeleteRuleRequest
                    {
                        Name = cloudStopRule
                    };
                    DeleteRuleResponse deleteRuleResponse = cloudWatchClient.DeleteRule(deleteRuleRequest);
                    Console.WriteLine("Code = " + deleteRuleResponse.HttpStatusCode);
                    deleteRuleRequest.Name = cloudNotifyRule;
                    cloudWatchClient.DeleteRule(deleteRuleRequest);
                    Console.WriteLine("Code = " + deleteRuleResponse.HttpStatusCode);
                    System.Environment.Exit(0);
                }
                else if (name.Equals("Arguments") && value.ToString().Equals("close"))
                {
                    timer.Stop();
                    System.Environment.Exit(0);
                }
            }
        }

        private static void changeTime(Object source, System.Timers.ElapsedEventArgs e)
        {
            minutes--;
            if (minutes == 0) { timer.Stop(); }
            changeXMLAndSendToast();
        }
        private static void changeXMLAndSendToast()
        {
            DescribeRuleRequest describeRuleRequest = new DescribeRuleRequest
            {
                Name = cloudStopRule
            };

            try
            {
                DescribeRuleResponse dscRuleresponse = cloudWatchClient.DescribeRule(describeRuleRequest);
            }
            catch(Exception e){
                timer.Stop();
                System.Environment.Exit(0);
            }
            IXmlNode minutesText = toastXml.SelectSingleNode("//text[@id='2']");
            if (minutesText != null)
            {
                minutesText.InnerText = "You have " + minutes + " minutes for save game or cancel shutdown";
            }
            else { Console.WriteLine("its null!"); }
            ToastNotification toast = new ToastNotification(toastXml);
            toast.Activated += ToastActivated;
            toast.Tag = "StopScredule";
            toast.Group = "StopScredule";
            toast.ExpirationTime = DateTimeOffset.Now.AddMinutes(minutes);
            // Show the toast. Be sure to specify the AppUserModelId on your application's shortcut!
            ToastNotificationManager.CreateToastNotifier(APP_ID).Show(toast);
        }
        public static string GetExecutingDirectory()
        {
            return System.IO.Path.GetDirectoryName(Assembly.GetEntryAssembly().Location);
        }
    }

}
