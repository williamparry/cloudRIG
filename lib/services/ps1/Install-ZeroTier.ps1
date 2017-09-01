# Install ZeroTier

New-Item -ItemType directory -Path "c:\cloudRIG\Setup\ZeroTier" -Force

Set-Net6to4Configuration -State disabled
Set-NetTeredoConfiguration -Type disabled
Set-NetIsatapConfiguration -State disabled
(New-Object System.Net.WebClient).DownloadFile("https://download.zerotier.com/dist/ZeroTier%20One.msi", "c:\cloudRIG\Setup\ZeroTier\zerotier.msi")
msiexec /a c:\cloudRIG\Setup\ZeroTier\zerotier.msi TARGETDIR=c:\cloudRIG\Setup\ZeroTier\zerotier /qn | Out-Null
(Get-AuthenticodeSignature -FilePath "c:\cloudRIG\Setup\ZeroTier\zerotier\CommonAppDataFolder\ZeroTier\One\tap-windows\x64\zttap300.cat").SignerCertificate | Export-Certificate -Type CERT -FilePath "c:\cloudRIG\Setup\ZeroTier\zerotier\zerotier.cer"
Import-Certificate -FilePath "c:\cloudRIG\Setup\ZeroTier\zerotier\zerotier.cer" -CertStoreLocation 'Cert:\LocalMachine\TrustedPublisher'
msiexec /qn /i c:\cloudRIG\Setup\ZeroTier\zerotier.msi | Out-Null

return $LASTEXITCODE