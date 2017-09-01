# Install Device Management

New-Item -ItemType directory -Path "c:\cloudRIG\Setup\DeviceManagement" -Force
Install-PackageProvider -Name NuGet -Force

(New-Object System.Net.WebClient).DownloadFile("https://gallery.technet.microsoft.com/Device-Management-7fad2388/file/65051/2/DeviceManagement.zip", "c:\cloudRIG\Setup\DeviceManagement\DeviceManagement.zip")
Expand-Archive -LiteralPath "c:\cloudRIG\Setup\DeviceManagement\DeviceManagement.zip" -DestinationPath "c:\cloudRIG\Setup\DeviceManagement\DeviceManagement"
Move-Item "c:\cloudRIG\Setup\DeviceManagement\DeviceManagement\Release" $PSHOME\Modules\DeviceManagement

$LASTEXITCODE