# Set folder and computer name

New-Item -ItemType directory -Path "c:\cloudRIG" -Force
New-Item -ItemType directory -Path "c:\cloudRIG\Setup" -Force

Rename-Computer -NewName "cloudRIG"

return $LASTEXITCODE