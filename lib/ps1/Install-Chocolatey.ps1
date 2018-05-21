Set-ExecutionPolicy Bypass -Scope Process -Force;
if ([bool](Get-Command -Name 'choco' -ErrorAction SilentlyContinue) -ne "True")
{
    iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))
}
return "ok"