@echo off
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0send-message.ps1" -Event STAGE_START
if errorlevel 1 pause
