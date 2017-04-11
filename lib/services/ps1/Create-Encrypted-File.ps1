$tmpFile = New-TemporaryFile
$bytes = [Convert]::FromBase64String("{{input}}")
[IO.File]::WriteAllBytes($tmpFile, $bytes)
Write-Host $tmpFile