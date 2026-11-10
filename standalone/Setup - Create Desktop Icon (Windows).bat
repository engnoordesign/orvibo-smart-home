@echo off
rem Creates a desktop shortcut (with icon) that opens the simulator directly.
set "DIR=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Desktop')+'\ORVIBO Smart Home Simulator.lnk'); $s.TargetPath='%DIR%ORVIBO Smart Home Simulator.html'; $s.IconLocation='%DIR%icon.ico'; $s.WorkingDirectory='%DIR%'; $s.Description='Digital Home - ORVIBO Smart Living Simulator'; $s.Save()"
echo.
echo Shortcut created on your Desktop. Starting the simulator...
start "" "%DIR%ORVIBO Smart Home Simulator.html"
timeout /t 3 >nul
