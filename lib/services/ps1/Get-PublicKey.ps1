# Get Public Key

cd c:\crsetup\openssl\
$pubkey = & .\openssl rsa -in key.pem -pubout | Out-String
Write-Host $pubkey