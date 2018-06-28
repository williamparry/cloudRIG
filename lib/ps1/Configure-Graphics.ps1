$driverData = ConvertFrom-Csv -Delimiter "," -InputObject (cmd /c "C:\Program Files\NVIDIA Corporation\NVSMI\nvidia-smi.exe"  --query-gpu=gpu_name,driver_version --format=csv)

# Driver search and download technique from https://github.com/lg/cloudy-gamer/blob/master/cloudygamer.psm1

If($driverData.name -eq "Tesla M60") {
    
   # Nvidia Tesla M60
    $onlineDrivers = (New-Object System.Net.WebClient).DownloadString("https://www.nvidia.com/Download/processFind.aspx?psid=75&pfid=783&osid=74&lid=1&lang=en-us&ctk=19")
    $onlineDriverVersion = $($onlineDrivers -match '<td class="gridItem">(\d\d\d\.\d\d)</td>' | Out-Null; $Matches[1])
    $onlineDriverFile = "https://us.download.nvidia.com/Windows/Quadro_Certified/$onlineDriverVersion/$onlineDriverVersion-tesla-desktop-winserver2016-international.exe"
   
} ElseIf($driverData.name -eq "GRID K520") {
    
    # Nvidia GRID K520
    $onlineDrivers = (New-Object System.Net.WebClient).DownloadString("https://www.nvidia.com/Download/processFind.aspx?psid=94&pfid=704&osid=57&lid=1&whql=1&lang=en-us&ctk=0")
    $onlineDriverVersion = $($onlineDrivers -match '<td class="gridItem">R.*\((.*)\)</td>' | Out-Null; $Matches[1])
    $onlineDriverFile = "https://us.download.nvidia.com/Windows/Quadro_Certified/GRID/$onlineDriverVersion/Quadro-Passthrough/$onlineDriverVersion-quadro-grid-desktop-notebook-win10-64bit-international-whql.exe"  

}

If($driverData.driver_version -notmatch $onlineDriverVersion) {

    (New-Object System.Net.WebClient).DownloadFile($onlineDriverFile, "c:\cloudRIG\nvidia.exe")

    $existingDriverSearch = Get-ItemProperty HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\* | Where-Object { $_.DisplayName -match "NVIDIA Graphics Driver" } | Select-Object UninstallString

    Start-Process -FilePath cmd.exe -ArgumentList '/c', $existingDriverSearch.UninstallString -Wait

    & c:\cloudRIG\nvidia.exe -s -clean -noreboot -noeula | Out-Null

}

Write-Host "ok"