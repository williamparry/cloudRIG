# Set Auto Logon

[Reflection.Assembly]::LoadWithPartialName("System.Web")

$launchConfigLocation = "C:\ProgramData\Amazon\EC2-Windows\Launch\Config\LaunchConfig.json"
$pass = [System.Web.Security.Membership]::GeneratePassword(36, 10)
$a = Get-Content $launchConfigLocation -raw | ConvertFrom-Json
$a.adminPasswordType = "Specify"
$a.adminPassword = $pass
$a | ConvertTo-Json  | set-content $launchConfigLocation
& "C:\ProgramData\Amazon\EC2-Windows\Launch\Scripts\InitializeInstance.ps1" -Schedule | Out-Null
# Auto login
New-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon' -Name AutoAdminLogon -Value 1
New-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon' -Name DefaultUserName -Value "administrator"
New-ItemProperty -Path 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\Winlogon' -Name DefaultPassword -Value $pass

return $LASTEXITCODE