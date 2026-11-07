@echo off
cd /d "%~dp0"
if not exist "runtime\electron.exe" (
  echo [%date% %time%] runtime\electron.exe missing >> "%~dp0..\pet.log"
  mshta "javascript:alert('桌宠运行时缺失：\npet\\runtime\\electron.exe\n\n可能被杀毒软件隔离或解压不完整。\n请重新解压，或把该文件加入白名单。');close()"
  exit /b 1
)
set ELECTRON_RUN_AS_NODE=
start "" "runtime\electron.exe" "%~dp0."