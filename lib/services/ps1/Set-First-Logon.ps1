Set-Content -Path "c:\crsetup\First-Logon.ps1" -Value 'Write-Host "Welcome to cloudRIG one-time setup" -BackgroundColor Black

Write-Host "`nConfiguring..."

Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced" -Name TaskbarGlomLevel -Value 2
Set-ItemProperty -Path "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer" -Name EnableAutoTray -Value 0
Set-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\PenWorkspace" -Name PenWorkspaceButtonDesiredVisibility -Value 0
Set-ItemProperty -Path "HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Explorer\VisualEffects" -Name "VisualFXSetting" -Value 2
$key = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced"
Set-ItemProperty $key HideFileExt 0
Set-ItemProperty $key HideDrivesWithNoMedia 0
Set-ItemProperty $key Hidden 1
Set-ItemProperty $key AutoCheckSelect 0

Write-Host "`nMaking Disconnect shortcut..."

$Shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut("$home\Desktop\Disconnect.lnk")
$Shortcut.TargetPath = "C:\Windows\System32\tscon.exe"
$Shortcut.Arguments = "%sessionname% /dest:console"
$Shortcut.Save()

Write-Host "`nYou are now going to set up a Steam shortcut that runs when the computer boots up.`n"

$Username = Read-Host -Prompt "Please enter your Steam username"
$spwd = Read-host -AsSecureString "Please enter your Steam password" 

$BSTR = `
    [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($spwd)
$Password = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

$link = "C:\Users\Administrator\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup"

$Shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut("$link\Steam.lnk")
$Shortcut.TargetPath = "C:\Program Files (x86)\Steam\Steam.exe"
$Shortcut.Arguments = "-login $Username $Password"
$Shortcut.Save()

Write-Host "`n`nShortcut with credentials saved to $link`n" -ForegroundColor magenta

Write-Host "`nYou will now log in for the first time. Once you are logged in (including Steam Guard) press any key to continue."

& "$link\Steam.lnk"

$host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Write-Host "You should see that this computer is available for streaming.`n`nPress any key to disconnect"

$host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

& "C:\Users\Administrator\Desktop\Disconnect.lnk" | Out-Null' -Force

Set-Content -Path "C:\Users\Administrator\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\First-Logon.bat" -Value '@echo off
PowerShell.exe -File c:\crsetup\First-Logon.ps1
(goto) 2>nul & del "%~f0"' -Force

return "ok"