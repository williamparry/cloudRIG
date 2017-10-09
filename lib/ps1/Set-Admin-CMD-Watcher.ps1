# Make blank file ready for commands

New-Item -ItemType directory -Path "c:\cloudRIG\Admin-CMD" -Force | Out-Null

New-Item c:\cloudRIG\Admin-CMD\Admin-CMD.ps1 -type file | Out-Null

Set-Content -Path c:\cloudRIG\Admin-CMD\Admin-CMD-Watcher.ps1 -Value '
Function Register-Watcher {
    param ($folder)
    $filename = "admin-cmd.ps1"
    $watcher = New-Object IO.FileSystemWatcher $folder, $filename -Property @{ 
        IncludeSubdirectories = $false
        EnableRaisingEvents = $true
    }

    $changeAction = [scriptblock]::Create("
        cd $folder
        .\$filename
    ")

    Register-ObjectEvent $Watcher "Changed" -Action $changeAction
}

 Register-Watcher "c:\cloudRIG\Admin-CMD\"' -Force
 
 Set-Content -Path "C:\Users\Administrator\AppData\Roaming\Microsoft\Windows\Start Menu\Programs\Startup\Set-Admin-CMD-Watcher.bat" -Value '@echo off
 PowerShell.exe -NoExit -File c:\cloudRIG\Admin-CMD\Admin-CMD-Watcher.ps1' -Force
 
 return "ok"