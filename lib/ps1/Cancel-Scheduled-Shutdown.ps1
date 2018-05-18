Unregister-ScheduledTask -TaskName CloudRIGScheduledShutdownNotification -Confirm:$false
Unregister-ScheduledTask -TaskName CloudRIGScheduledShutdown -Confirm:$false
return "ok"