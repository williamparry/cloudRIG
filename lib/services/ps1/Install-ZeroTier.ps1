# Install ZeroTier

Set-Net6to4Configuration -State disabled
Set-NetTeredoConfiguration -Type disabled
Set-NetIsatapConfiguration -State disabled
(New-Object System.Net.WebClient).DownloadFile("https://download.zerotier.com/dist/ZeroTier%20One.msi", "c:\crsetup\zerotier.msi")
msiexec /a c:\crsetup\zerotier.msi TARGETDIR=C:\crsetup\zerotier /qn | Out-Null
(Get-AuthenticodeSignature -FilePath "c:\crsetup\zerotier\CommonAppDataFolder\ZeroTier\One\tap-windows\x64\zttap300.cat").SignerCertificate | Export-Certificate -Type CERT -FilePath "c:\crsetup\zerotier\zerotier.cer"
Import-Certificate -FilePath "c:\crsetup\zerotier\zerotier.cer" -CertStoreLocation 'Cert:\LocalMachine\TrustedPublisher'
msiexec /qn /i c:\crsetup\zerotier.msi | Out-Null

return $LASTEXITCODE