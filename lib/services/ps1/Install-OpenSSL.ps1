# Install OpenSSL

(New-Object System.Net.WebClient).DownloadFile("https://indy.fulgan.com/SSL/openssl-0.9.8r-x64_86-win64-rev2.zip", "c:\crsetup\openssl.zip")
Expand-Archive -LiteralPath "c:\crsetup\openssl.zip" -DestinationPath "c:\crsetup\openssl-temp"
Move-Item "c:\crsetup\openssl-temp\openssl-0.9.8r-x64_86-win64-rev2" -Destination "c:\crsetup\openssl"
Remove-Item "c:\crsetup\openssl-temp"
cd c:\crsetup\openssl\
& .\openssl.exe genrsa -out key.pem 4096
$LASTEXITCODE