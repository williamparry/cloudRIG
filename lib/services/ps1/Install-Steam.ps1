# Install Steam

(New-Object System.Net.WebClient).DownloadFile("https://steamcdn-a.akamaihd.net/client/installer/SteamSetup.exe", "c:\crsetup\steamsetup.exe")
& c:\crsetup\steamsetup.exe /S | Out-Null

return $LASTEXITCODE