# This is run by EC2 as part of the provisioning process when the user first logs in
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name TaskbarGlomLevel -Value 2
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer" -Name EnableAutoTray -Value 0
Set-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\PenWorkspace" -Name PenWorkspaceButtonDesiredVisibility -Value 0
Set-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects" -Name "VisualFXSetting" -Value 2
$key = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced'
Set-ItemProperty $key HideFileExt 0
Set-ItemProperty $key HideDrivesWithNoMedia 0
Set-ItemProperty $key Hidden 1
Set-ItemProperty $key AutoCheckSelect 0
$Shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut("$home\Desktop\Disconnect.lnk")
$Shortcut.TargetPath = "C:\Windows\System32\tscon.exe"
$Shortcut.Arguments = @'
%sessionname% /dest:console"
'@
$Shortcut.Save()
$bytes = [System.IO.File]::ReadAllBytes("$home\Desktop\Disconnect.lnk")
$bytes[0x15] = $bytes[0x15] -bor 0x20
[System.IO.File]::WriteAllBytes("$home\Desktop\Disconnect.lnk", $bytes)

Install-PackageProvider -Name NuGet -Force

(New-Object System.Net.WebClient).DownloadFile("https://gallery.technet.microsoft.com/Device-Management-7fad2388/file/65051/2/DeviceManagement.zip", "c:\crsetup\DeviceManagement.zip")
Expand-Archive -LiteralPath "c:\crsetup\DeviceManagement.zip" -DestinationPath "c:\crsetup\DeviceManagement"
Move-Item "c:\crsetup\DeviceManagement\Release" $PSHOME\Modules\DeviceManagement
Import-Module DeviceManagement
Get-Device | where Name -eq "Microsoft Basic Display Adapter" | Disable-Device
takeown /f C:\Windows\System32\Drivers\BasicDisplay.sys
icacls C:\Windows\System32\Drivers\BasicDisplay.sys /grant "$env:username`:F"
move C:\Windows\System32\Drivers\BasicDisplay.sys C:\Windows\System32\Drivers\BasicDisplay.old