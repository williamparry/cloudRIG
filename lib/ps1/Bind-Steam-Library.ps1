#
# . DEPRECATED - DEAD CODE
#


$LibraryFolders = "C:\Program Files (x86)\Steam\steamapps\libraryfolders.vdf"

New-Item -ItemType directory -Path "D:\SteamLibrary" -Force

(Get-Content $LibraryFolders) -replace "}", "`"1`" `"D:\SteamLibrary`" }" | Out-File $LibraryFolders

return "ok"
