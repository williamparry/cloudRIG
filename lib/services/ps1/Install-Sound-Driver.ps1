# Install Sound Driver

Set-Service Audiosrv -startuptype "automatic"
Start-Service Audiosrv
(New-Object System.Net.WebClient).DownloadFile("http://vbaudio.jcedeveloppement.com/Download_CABLE/VBCABLE_Driver_Pack43.zip", "c:\crsetup\vbcable.zip")
Expand-Archive -LiteralPath "c:\crsetup\vbcable.zip" -DestinationPath "c:\crsetup\vbcable"
(Get-AuthenticodeSignature -FilePath "c:\crsetup\vbcable\vbaudio_cable64_win7.cat").SignerCertificate | Export-Certificate -Type CERT -FilePath "c:\crsetup\vbcable\vbcable.cer"
Import-Certificate -FilePath "c:\crsetup\vbcable\vbcable.cer" -CertStoreLocation 'Cert:\LocalMachine\TrustedPublisher'
& c:\crsetup\vbcable\VBCABLE_Setup_x64.exe -i | Out-Null

return $LASTEXITCODE