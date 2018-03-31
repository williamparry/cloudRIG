using System;
using Windows.UI.Notifications;
using Windows.Data.Xml.Dom;
using Windows.Foundation;
using Microsoft.Win32;
using System.Timers;
using System.Reflection;
using System.IO;
using System.Diagnostics;
using System.Runtime.InteropServices;

namespace CancelShutdownApp
{
    class Program
    {
        [DllImport("kernel32.dll")]
        static extern IntPtr GetConsoleWindow();

        [DllImport("user32.dll")]
        static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

        const int SW_HIDE = 0;
        const int SW_SHOW = 5;

        private static bool isOneInstance = true;
        private static string APP_ID = "8446f277-7064-44c4-b702-360fcf67e412";
        private static int minutes = 1;
        private static Timer timer = new Timer();
        private static string operationName;
        private static XmlDocument toastXml = new XmlDocument();
        private static ToastNotification currentNotification;
        private static PipeServer pipeServer;
        public delegate void NewMessageDelegate(string NewMessage);
        static void Main(string[] args)
        {
            var handle = GetConsoleWindow();
            ShowWindow(handle, SW_HIDE);
            if (args.Length < 1)
            {
                System.Environment.Exit(1);
            }
            operationName = args[0];
            System.Threading.Mutex mutex = new System.Threading.Mutex(true, "cloudrigschedulerMutex", out isOneInstance);
            if (operationName.Equals("-shutdown") && isOneInstance && args.Length > 1)
            {
                minutes = Int32.Parse(args[1]);
                createServer();
                startSchedule();
            }
            else if (operationName.Equals("-cancelshutdown") && !isOneInstance)
            {
                SendMessageToServer("-cancelshutdown");
            }
            else if (operationName.Equals("-extendshutdown") && !isOneInstance && args.Length > 1)
            {
                SendMessageToServer("-extendshutdown " + args[1]);
            }

            Environment.Exit(1);
        }
        private static void startSchedule()
        {
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
                Console.WriteLine(value.ToString());
                if (name.Equals("Arguments") && value.ToString().Equals("cancel"))
                {
                    timer.Stop();
                    Console.WriteLine("Trying to cancel a shutdown!");
                    Environment.Exit(0);
                }
                else if (name.Equals("Arguments") && value.ToString().Equals("extend"))
                {
                    Console.WriteLine("One hour shutdown extend!");
                    minutes += 60;
                }
            }
        }

        private static void changeTime(Object source, ElapsedEventArgs e)
        {
            minutes--;
            if (minutes == 0)
            {
                timer.Stop();
                Process.Start("shutdown", "/s /t 0");
                Environment.Exit(0);
            }
            changeXMLAndSendToast();
        }
        private static void changeXMLAndSendToast()
        {
            if (minutes>=60) return;
            IXmlNode minutesText = toastXml.SelectSingleNode("//text[@id='2']");
            if (minutesText != null)
            {
                minutesText.InnerText = "You have " + minutes + " minutes for save game or cancel shutdown";
            }
            else { Console.WriteLine("its null!"); }

            // Show the toast. Be sure to specify the AppUserModelId on your application's shortcut!
            ToastNotificationManager.CreateToastNotifier(APP_ID).Show(createToastNotification());
        }
        private static ToastNotification createToastNotification()
        {
            ToastNotification toast = new ToastNotification(toastXml);
            toast.Tag = "StopScredule";
            toast.Group = "StopScredule";
            toast.Activated += ToastActivated;
            toast.ExpirationTime = DateTimeOffset.Now.AddMinutes(minutes);
            currentNotification = toast;
            return toast;
        }
        public static string GetExecutingDirectory()
        {
            return Path.GetDirectoryName(Assembly.GetEntryAssembly().Location);
        }
        public static void CancelAndDeleteNotify()
        {
           Console.WriteLine("Cancel activated!");
           timer.Stop();
           ToastNotificationManager.CreateToastNotifier(APP_ID).Hide(currentNotification);
           Environment.Exit(0);
        }
        private static void createServer()
        {
            pipeServer = new PipeServer();
            pipeServer.PipeMessage += new DelegateMessage(PipesMessageHandler);
            pipeServer.Listen("CancelShutdownApp");
        }
        private static void PipesMessageHandler(string message)
        {
            try
            {
                string[] message_array = message.Split(' ');
                if (message.StartsWith("-cancelshutdown"))
                {
                    CancelAndDeleteNotify();
                }
                else if (message_array[0].Equals("-extendshutdown"))
                {
                    Console.WriteLine("Extend shutdown!");
                    minutes +=Int32.Parse(message_array[1]);
                    ToastNotificationManager.CreateToastNotifier(APP_ID).Hide(currentNotification);
                    changeXMLAndSendToast();
                }
 
            }
            catch (Exception ex)
            {

                Debug.WriteLine(ex.Message);
            }

        }
        private static void SendMessageToServer(string message)
        {
            PipeClient pipeClient = new PipeClient();
            pipeClient.Send(message, "CancelShutdownApp", 10000);
        }
        }
    }

