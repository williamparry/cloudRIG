$action = New-ScheduledTaskAction -Execute "Powershell" -Argument '-WindowStyle Hidden -File c:\cloudRIG\Notify-Shutdown.ps1 -reason __CLOUDRIG_REASON__'
$trigger = New-ScheduledTaskTrigger -Once -At (get-date).AddMinutes(__CLOUDRIG_REMAININGMINUTES__).ToString("HH:mm")
$principal = New-ScheduledTaskPrincipal -UserId (Get-CimInstance –ClassName Win32_ComputerSystem | Select-Object -expand UserName)
$task = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal
Register-ScheduledTask CloudRIGScheduledShutdownNotification -InputObject $task