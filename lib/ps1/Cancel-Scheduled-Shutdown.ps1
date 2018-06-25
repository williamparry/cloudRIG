Unregister-ScheduledTask -TaskName CloudRIGScheduledShutdownNotification -Confirm:$false
Unregister-ScheduledTask -TaskName CloudRIGScheduledShutdown -Confirm:$false
Unregister-ScheduledTask -TaskName CloudRIGTerminationChecker -Confirm:$false
return "ok"