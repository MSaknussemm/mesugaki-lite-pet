@echo off
cd /d "%~dp0"
echo ================================================
echo  Mesugaki Lite Pet - setup
echo  首次使用会下载 Electron 运行时（约 151MB）
echo ================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"
echo.
pause
