# Install Launch Tools

New-Item -ItemType directory -Path "c:\cloudRIG\Setup\Launch-Tools" -Force

(New-Object System.Net.WebClient).DownloadFile("https://s3.amazonaws.com/ec2-downloads-windows/EC2Launch/latest/EC2-Windows-Launch.zip", "c:\cloudRIG\Setup\Launch-Tools\EC2-Windows-Launch.zip")
(New-Object System.Net.WebClient).DownloadFile("https://s3.amazonaws.com/ec2-downloads-windows/EC2Launch/latest/install.ps1", "c:\cloudRIG\Setup\Launch-Tools\install.ps1")
& "c:\cloudRIG\Setup\Launch-Tools\install.ps1" | Out-Null

return $LASTEXITCODE