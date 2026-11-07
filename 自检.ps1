$ErrorActionPreference = 'SilentlyContinue'
$base = Split-Path -Parent $MyInvocation.MyCommand.Path
$pet  = if (Test-Path (Join-Path $base 'pet\main.js')) { Join-Path $base 'pet' } else { $base }
$ok = 0; $warn = 0; $bad = 0
function Line($status, $text) {
  $color = switch ($status) { 'PASS' {'Green'} 'WARN' {'Yellow'} default {'Red'} }
  Write-Host ("[{0}] {1}" -f $status, $text) -ForegroundColor $color
}
Write-Host "==== 鲸鱼娘陪玩包 自检 ====" -ForegroundColor Cyan
Write-Host "目录: $base`n"

# 1 runtime
$exe = Join-Path $pet 'runtime\electron.exe'
if ((Test-Path $exe) -and (Get-Item $exe).Length -gt 100MB) { Line 'PASS' "runtime 存在 ($([math]::Round((Get-Item $exe).Length/1MB)) MB)"; $ok++ }
else { Line 'FAIL' "runtime 缺失或过小：$exe"; $bad++ }

# 2 动画
$anims = @('idle','talk','angry','happy','tongue','failure')
$miss = @()
foreach ($a in $anims) { $f = Join-Path $pet "assets\$a.webm"; if (-not (Test-Path $f) -or (Get-Item $f).Length -lt 1MB) { $miss += $a } }
if ($miss.Count -eq 0) { Line 'PASS' "6 段动画齐全"; $ok++ } else { Line 'FAIL' ("动画缺失/过小: " + ($miss -join ', ')); $bad++ }

# 3 配置
$cfgPath = Join-Path $pet 'config.json'
try {
  $cfg = Get-Content $cfgPath -Raw -Encoding UTF8 | ConvertFrom-Json
  $gd = $cfg.game_dir
  if (-not [System.IO.Path]::IsPathRooted($gd)) { $gd = Join-Path $pet $gd }
  if (Test-Path $gd) { Line 'PASS' "config.json 正常，game_dir -> $gd"; $ok++ }
  else { Line 'WARN' "config.json 正常，但 game_dir 不存在（纯桌宠模式可忽略）：$gd"; $warn++ }
} catch { Line 'FAIL' "config.json 解析失败"; $bad++ }

# 4 端口
$port = $cfg.port
if ($port) {
  $conn = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
  if (-not $conn) { Line 'WARN' "端口 $port 空闲——桌宠当前没有运行"; $warn++ }
  else {
    try { $h = Invoke-WebRequest -Uri "http://127.0.0.1:$port/health" -UseBasicParsing -TimeoutSec 3
          Line 'PASS' "端口 $port 已被桌宠占用，/health 正常"; $ok++ }
    catch { Line 'WARN' "端口 $port 被其他程序占用（桌宠会收不到台词）"; $warn++ }
  }
} else { Line 'WARN' "没有可用的端口配置，跳过端口检查"; $warn++ }

# 5 环境变量
if ($env:ELECTRON_RUN_AS_NODE) { Line 'WARN' "环境里有 ELECTRON_RUN_AS_NODE=$($env:ELECTRON_RUN_AS_NODE)，可能导致 electron 当 node 跑"; $warn++ }
else { Line 'PASS' "ELECTRON_RUN_AS_NODE 未设置"; $ok++ }

# 6 游戏数据（AI 包才有）
$game = Join-Path $base 'game'
if (Test-Path $game) {
  $dat = Join-Path $game 'th07.dat'; $bgm = Join-Path $game 'thbgm.dat'
  if ((Test-Path $dat) -and (Test-Path $bgm)) { Line 'PASS' "游戏数据齐全"; $ok++ }
  else { Line 'FAIL' "游戏数据缺失（th07.dat / thbgm.dat）"; $bad++ }
  if (Test-Path (Join-Path $game 'th07_multi.exe')) { Line 'PASS' "th07_multi.exe 存在"; $ok++ } else { Line 'FAIL' "th07_multi.exe 缺失"; $bad++ }
} else { Line 'WARN' "没有 game 目录（纯桌宠包，正常）"; $warn++ }

# 7 配置目录可写
$prof = Join-Path $env:APPDATA 'mesugaki-lite'
try { New-Item -ItemType Directory -Force -Path $prof | Out-Null; $tf = Join-Path $prof '.selftest'
      'ok' | Set-Content $tf; Remove-Item $tf -Force; Line 'PASS' "配置目录可写"; $ok++ }
catch { Line 'FAIL' "配置目录不可写：$prof"; $bad++ }

# 8 图标
if (Test-Path (Join-Path $base '鲸鱼娘.ico')) { Line 'PASS' "图标存在"; $ok++ } else { Line 'WARN' "缺少 鲸鱼娘.ico（快捷方式会空白）"; $warn++ }

Write-Host "`n结果：通过 $ok  警告 $warn  失败 $bad" -ForegroundColor Cyan
if ($bad -gt 0) { Write-Host "有失败项，按上面提示处理；桌宠起不来时可先运行 重置桌宠配置.cmd" -ForegroundColor Yellow }
Read-Host "`n按回车关闭"