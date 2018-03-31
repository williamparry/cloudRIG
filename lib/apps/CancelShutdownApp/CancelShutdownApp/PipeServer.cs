// Delegate for passing received message back to caller
using System;
using System.Diagnostics;
using System.IO.Pipes;
using System.Text;

public delegate void DelegateMessage(string Reply);

class PipeServer
{
    public event DelegateMessage PipeMessage;
    string _pipeName;

    public void Listen(string PipeName)
    {
        try
        {
            // Set to class level var so we can re-use in the async callback method
            _pipeName = PipeName;
            // Create the new async pipe 
            NamedPipeServerStream pipeServer = new NamedPipeServerStream(PipeName,
               PipeDirection.In, 1, PipeTransmissionMode.Byte, PipeOptions.Asynchronous);

            // Wait for a connection
            pipeServer.BeginWaitForConnection
            (new AsyncCallback(WaitForConnectionCallBack), pipeServer);
        }
        catch (Exception oEX)
        {
            Debug.WriteLine(oEX.Message);
        }
    }

    private void WaitForConnectionCallBack(IAsyncResult iar)
    {
        try
        {
            // Get the pipe
            NamedPipeServerStream pipeServer = (NamedPipeServerStream)iar.AsyncState;
            // End waiting for the connection
            pipeServer.EndWaitForConnection(iar);

            byte[] buffer = new byte[255];

            // Read the incoming message
            pipeServer.Read(buffer, 0, 255);

            // Convert byte buffer to string
            string stringData = Encoding.UTF8.GetString(buffer, 0, buffer.Length);
            Debug.WriteLine(stringData + Environment.NewLine);

            // Pass message back to calling form
            PipeMessage.Invoke(stringData);

            // Kill original sever and create new wait server
            pipeServer.Close();
            pipeServer = null;
            pipeServer = new NamedPipeServerStream(_pipeName, PipeDirection.In,
               1, PipeTransmissionMode.Byte, PipeOptions.Asynchronous);

            // Recursively wait for the connection again and again....
            pipeServer.BeginWaitForConnection(
               new AsyncCallback(WaitForConnectionCallBack), pipeServer);
        }
        catch
        {
            return;
        }
    }
}