# Install Sound Driver

New-Item -ItemType directory -Path "c:\cloudRIG\Setup\Sound" -Force

Set-Service Audiosrv -startuptype "automatic"
Start-Service Audiosrv
(New-Object System.Net.WebClient).DownloadFile("http://vbaudio.jcedeveloppement.com/Download_CABLE/VBCABLE_Driver_Pack43.zip", "c:\cloudRIG\Setup\Sound\vbcable.zip")
Expand-Archive -LiteralPath "c:\cloudRIG\Setup\Sound\vbcable.zip" -DestinationPath "c:\cloudRIG\Setup\Sound\vbcable"
(Get-AuthenticodeSignature -FilePath "c:\cloudRIG\Setup\Sound\vbcable\vbaudio_cable64_win7.cat").SignerCertificate | Export-Certificate -Type CERT -FilePath "c:\cloudRIG\Setup\Sound\vbcable\vbcable.cer"
Import-Certificate -FilePath "c:\cloudRIG\Setup\Sound\vbcable\vbcable.cer" -CertStoreLocation 'Cert:\LocalMachine\TrustedPublisher'
& c:\cloudRIG\Setup\Sound\vbcable\VBCABLE_Setup_x64.exe -i | Out-Null

return "ok"