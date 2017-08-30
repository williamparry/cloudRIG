# Set Display Adapter

Import-Module DeviceManagement

Get-Device | where Name -eq "Microsoft Basic Display Adapter" | Disable-Device
takeown /f C:\Windows\System32\Drivers\BasicDisplay.sys
icacls C:\Windows\System32\Drivers\BasicDisplay.sys /grant "$env:username`:F"
move C:\Windows\System32\Drivers\BasicDisplay.sys C:\Windows\System32\Drivers\BasicDisplay.old

return $LASTEXITCODE