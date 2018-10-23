$action = New-ScheduledTaskAction -Execute "c:\cloudRIG\Termination-Checker.vbs"
$trigger = New-ScheduledTaskTrigger -Once -At (get-date).Date -RepetitionInterval (New-TimeSpan -Minutes 1) -RepetitionDuration (New-TimeSpan -Minutes 1402)
$principal = New-ScheduledTaskPrincipal -UserId (Get-CimInstance -ClassName Win32_ComputerSystem | Select-Object -expand UserName)
$task = New-ScheduledTask -Action $action -Trigger $trigger -Principal $principal
Register-ScheduledTask CloudRIGTerminationChecker -InputObject $task