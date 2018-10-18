$action = New-ScheduledTaskAction -Execute "Powershell" -Argument '-WindowStyle Hidden -Command "& { Stop-Computer -Force }"'
$trigger = New-ScheduledTaskTrigger -Once -At (get-date).AddMinutes(__CLOUDRIG_REMAININGMINUTES__).ToString("HH:mm")
$principal = New-ScheduledTaskPrincipal -UserId (Get-CimInstance –ClassName Win32_ComputerSystem | Select-Object -expand UserName)
$task = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal
Register-ScheduledTask CloudRIGScheduledShutdown -InputObject $task