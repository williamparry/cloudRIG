$tmpFile = New-TemporaryFile

cd c:\crsetup\openssl\
& .\openssl rsautl -decrypt -oaep -in {{input}} -out $tmpFile -inkey key.pem

$u,$p = (Get-Content $tmpFile) -split ","

$AppLocation = "c:\Program Files (x86)\Steam\Steam.exe"
$WshShell = New-Object -ComObject WScript.Shell
$Shortcut = $WshShell.CreateShortcut("C:\ProgramData\Microsoft\Windows\Start Menu\Programs\StartUp\steam.lnk")
$Shortcut.TargetPath = $AppLocation
$Shortcut.TargetType = "Application"
$Shortcut.Arguments = "-login $u $p"
$Shortcut.IconLocation = "hotplug.dll,0"
$Shortcut.Description = "Steam Autologin"
$Shortcut.WorkingDirectory ="C:\Windows\System32"
$Shortcut.Save()

Remove-Item $tmpFile
Remove-Item {{input}}
$LASTEXITCODE