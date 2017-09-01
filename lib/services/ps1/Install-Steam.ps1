# Install Steam

New-Item -ItemType directory -Path "c:\cloudRIG\Setup\Steam" -Force

(New-Object System.Net.WebClient).DownloadFile("https://steamcdn-a.akamaihd.net/client/installer/SteamSetup.exe", "c:\cloudRIG\Setup\Steam\steamsetup.exe")
& c:\cloudRIG\Setup\Steam\steamsetup.exe /S | Out-Null

return $LASTEXITCODE