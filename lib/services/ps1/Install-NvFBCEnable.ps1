# Install NvFBCEnable

(New-Object System.Net.WebClient).DownloadFile("https://s3-ap-southeast-2.amazonaws.com/cloudrig-assets/NvFBCEnable.zip", "c:\cloudRIG\Setup\DeviceManagement\NvFBCEnable.zip")
Expand-Archive -LiteralPath "c:\cloudRIG\Setup\DeviceManagement\NvFBCEnable.zip" -DestinationPath "c:\cloudRIG\Setup\DeviceManagement\NvFBCEnable"
& c:\cloudRIG\Setup\DeviceManagement\NvFBCEnable\NvFBCEnable.exe -enable -noreset | Out-Null

return $LASTEXITCODE