$disks = Get-Disk | Where-Object { $_.Size -ge "100GB" }
foreach ($disk in $disks) { Update-Disk -Number $disk.Number } 
$part_size = Get-PartitionSupportedSize -DriveLetter D
$current_part = Get-Partition -DriveLetter D
if($part_size.SizeMax -gt $current_part.Size){Resize-Partition -DriveLetter D -Size $part_size.SizeMax}
return "ok"