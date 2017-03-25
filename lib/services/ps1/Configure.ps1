# Turn off ie security
$AdminKey = "HKLM:\SOFTWARE\Microsoft\Active Setup\Installed Components\{A509B1A7-37EF-4b3f-8CFC-4F3A74704073}"
$UserKey = "HKLM:\SOFTWARE\Microsoft\Active Setup\Installed Components\{A509B1A8-37EF-4b3f-8CFC-4F3A74704073}"
Set-ItemProperty -Path $AdminKey -Name "IsInstalled" -Value 0
Set-ItemProperty -Path $UserKey -Name "IsInstalled" -Value 0

# Explorer set to performance
Set-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects" -Name "VisualFXSetting" -Value 2

# Disable some more scheduled tasks
Disable-ScheduledTask -TaskName 'ServerManager' -TaskPath '\Microsoft\Windows\Server Manager'
Disable-ScheduledTask -TaskName 'ScheduledDefrag' -TaskPath '\Microsoft\Windows\Defrag'
Disable-ScheduledTask -TaskName 'ProactiveScan' -TaskPath '\Microsoft\Windows\Chkdsk'
Disable-ScheduledTask -TaskName 'Scheduled' -TaskPath '\Microsoft\Windows\Diagnosis'
Disable-ScheduledTask -TaskName 'SilentCleanup' -TaskPath '\Microsoft\Windows\DiskCleanup'
Disable-ScheduledTask -TaskName 'WinSAT' -TaskPath '\Microsoft\Windows\Maintenance'
Disable-ScheduledTask -TaskName 'StartComponentCleanup' -TaskPath '\Microsoft\Windows\Servicing'

# Show file extensions, hidden items and disable item checkboxes
$key = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced'
Set-ItemProperty $key HideFileExt 0
Set-ItemProperty $key HideDrivesWithNoMedia 0
Set-ItemProperty $key Hidden 1
Set-ItemProperty $key AutoCheckSelect 0

# Disable telemetry
Set-ItemProperty "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\DataCollection" "AllowTelemetry" -Value 0

# Don't combine taskbar buttons and no tray hiding stuff
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name TaskbarGlomLevel -Value 2
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer" -Name EnableAutoTray -Value 0

# Hide the touchbar button on the systray
Set-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\PenWorkspace" -Name PenWorkspaceButtonDesiredVisibility -Value 0

# Disable unnecessary services
$services = @(
    "diagnosticshub.standardcollector.service" # Microsoft (R) Diagnostics Hub Standard Collector Service
    "DiagTrack"                                # Diagnostics Tracking Service
    "dmwappushservice"                         # WAP Push Message Routing Service
    "lfsvc"                                    # Geolocation Service
    "MapsBroker"                               # Downloaded Maps Manager
    "NetTcpPortSharing"                        # Net.Tcp Port Sharing Service
    "RemoteRegistry"                           # Remote Registry
    "SharedAccess"                             # Internet Connection Sharing (ICS)
    "TrkWks"                                   # Distributed Link Tracking Client
    "WbioSrvc"                                 # Windows Biometric Service
    "XblAuthManager"                           # Xbox Live Auth Manager
    "XblGameSave"                              # Xbox Live Game Save Service
    "LanmanServer"                             # File/Printer sharing
    "Spooler"                                  # Printing stuff
    "RemoteAccess"                             # Routing and Remote Access
)
foreach ($service in $services) {
    Set-Service $service -startuptype "disabled"
    Stop-Service $service -force
}

# Create shortcut to disconnect
$Shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut("$home\Desktop\Disconnect.lnk")
$Shortcut.TargetPath = "C:\Windows\System32\cmd.exe"
$Shortcut.Arguments = @'
/c "for /F "tokens=1 delims=^> " %i in ('""%windir%\system32\qwinsta.exe" | "%windir%\system32\find.exe" /I "^>rdp-tcp#""') do "%windir%\system32\tscon.exe" %i /dest:console"
'@
$Shortcut.Save()
$bytes = [System.IO.File]::ReadAllBytes("$home\Desktop\Disconnect.lnk")
$bytes[0x15] = $bytes[0x15] -bor 0x20
[System.IO.File]::WriteAllBytes("$home\Desktop\Disconnect.lnk", $bytes)



# Disable the basic display adapter and its monitors
Import-Module DeviceManagement
Get-Device | where Name -eq "Microsoft Basic Display Adapter" | Disable-Device  # aws

# Delete the basic display adapter's drivers (since some games still insist on using the basic adapter)
takeown /f C:\Windows\System32\Drivers\BasicDisplay.sys
#icacls C:\Windows\System32\Drivers\BasicDisplay.sys /grant "$env:username\`:F"
#move C:\Windows\System32\Drivers\BasicDisplay.sys C:\Windows\System32\Drivers\BasicDisplay.old

$LASTEXITCODE