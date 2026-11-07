# 下载 Electron 运行时到 runtime\（只需一次）
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$target = Join-Path $root 'runtime'
$exe = Join-Path $target 'electron.exe'

if (Test-Path $exe) {
    Write-Host "runtime 已存在：$exe" -ForegroundColor Green
    exit 0
}

$ver = '45.2.3'
$url = "https://github.com/electron/electron/releases/download/v$ver/electron-v$ver-win32-x64.zip"
$zip = Join-Path $env:TEMP "electron-v$ver-win32-x64.zip"

Write-Host "下载 Electron $ver（约 151MB，首次使用需要几分钟）..." -ForegroundColor Cyan
Write-Host "  $url"
$old = $ProgressPreference
$ProgressPreference = 'SilentlyContinue'
try {
    Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing
} finally {
    $ProgressPreference = $old
}

$size = (Get-Item $zip).Length
if ($size -lt 100MB) { throw "下载不完整：$([math]::Round($size/1MB,1)) MB" }

Write-Host "解压到 runtime\ ..." -ForegroundColor Cyan
New-Item -ItemType Directory -Force -Path $target | Out-Null
$tar = Get-Command tar.exe -ErrorAction SilentlyContinue
if ($tar) {
    & $tar.Source -xf $zip -C $target
    if ($LASTEXITCODE -ne 0) { Expand-Archive -Path $zip -DestinationPath $target -Force }
} else {
    Expand-Archive -Path $zip -DestinationPath $target -Force
}
Remove-Item $zip -Force -ErrorAction SilentlyContinue

if (-not (Test-Path $exe)) { throw "解压后没有找到 electron.exe，请检查 runtime\ 目录" }
Write-Host "完成。双击 Start.cmd 启动桌宠。" -ForegroundColor Green
