# Install Launch Tools

(New-Object System.Net.WebClient).DownloadFile("https://s3.amazonaws.com/ec2-downloads-windows/EC2Launch/latest/EC2-Windows-Launch.zip", "c:\crsetup\EC2-Windows-Launch.zip")
(New-Object System.Net.WebClient).DownloadFile("https://s3.amazonaws.com/ec2-downloads-windows/EC2Launch/latest/install.ps1", "c:\crsetup\install.ps1")
& "c:\crsetup\install.ps1" | Out-Null

return $LASTEXITCODE