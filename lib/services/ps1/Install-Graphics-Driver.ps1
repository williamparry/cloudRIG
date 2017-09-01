# Install Nvidia GRID K520

New-Item -ItemType directory -Path "c:\cloudRIG\Setup\Graphics" -Force

$drivers = (New-Object System.Net.WebClient).DownloadString("http://www.nvidia.com/Download/processFind.aspx?psid=94&pfid=704&osid=57&lid=1&whql=1&lang=en-us&ctk=0")
$driverversion = $($drivers -match '<td class="gridItem">R.*\((.*)\)</td>' | Out-Null; $Matches[1])
(New-Object System.Net.WebClient).DownloadFile("http://us.download.nvidia.com/Windows/Quadro_Certified/$driverversion/$driverversion-quadro-grid-desktop-notebook-win10-64bit-international-whql.exe", "c:\cloudRIG\Setup\Graphics\nvidia.exe")
& c:\cloudRIG\Setup\Graphics\nvidia.exe -s -clean -noreboot -noeula | Out-Null

return $LASTEXITCODE