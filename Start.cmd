@echo off
cd /d "%~dp0"
if not exist "runtime\electron.exe" (
  echo [setup] runtime\electron.exe 不存在，先下载 Electron 运行时...
  powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup.ps1"
  if not exist "runtime\electron.exe" (
    echo.
    echo [error] 运行时没有就绪，请手动双击 setup.cmd 重试。
    pause
    exit /b 1
  )
)
set ELECTRON_RUN_AS_NODE=
start "" "runtime\electron.exe" "%~dp0."
