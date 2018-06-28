@'
Set objFSO = CreateObject("Scripting.FileSystemObject")
strScript = Wscript.ScriptFullName
objFSO.DeleteFile(strScript)
Dim shell,command
command = "powershell.exe -nologo & { c:\cloudRIG\Notify-Shutdown.ps1 -reason __CLOUDRIG_REASON__ }"
Set shell = CreateObject("WScript.Shell")
shell.Run command,0
'@ | Out-File 'c:\cloudRIG\Notify-Shutdown-Launcher.vbs'

$action = New-ScheduledTaskAction -Execute "c:\cloudRIG\Notify-Shutdown-Launcher.vbs"
$trigger = New-ScheduledTaskTrigger -Once -At (get-date).AddMinutes(__CLOUDRIG_REMAININGMINUTES__).ToString("HH:mm")
$principal = New-ScheduledTaskPrincipal -UserId (Get-CimInstance –ClassName Win32_ComputerSystem | Select-Object -expand UserName)
$task = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal
Register-ScheduledTask CloudRIGScheduledShutdownNotification -InputObject $task