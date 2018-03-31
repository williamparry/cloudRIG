Write-Host "Create new shutdown job"
start powershell {cloudrigscheduler -shutdown 20}
Start-Sleep -s 15
Write-Host "Extend shutdown"
start powershell {cloudrigscheduler -extendshutdown 15}
Start-Sleep -s 15
Write-Host "Cancel shutdown"
start powershell {cloudrigscheduler -cancelshutdown}