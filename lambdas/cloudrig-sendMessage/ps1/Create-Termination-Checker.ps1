@'
Dim shell,command
command = "powershell.exe -nologo & { try { wget http://169.254.169.254/latest/meta-data/spot/termination-time | Unregister-ScheduledTask -TaskName CloudRIGTerminationChecker -Confirm:$false | PowerShell.exe -windowstyle hidden { & c:\cloudRIG\Notify-Shutdown.ps1 } } catch [Net.WebException] { } }"
Set shell = CreateObject("WScript.Shell")
shell.Run command,0
'@ | Out-File 'c:\cloudRIG\Termination-Checker.vbs'

return "ok"