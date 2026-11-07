$base = $PSScriptRoot
$desktop = [Environment]::GetFolderPath('Desktop')
$ws = New-Object -ComObject WScript.Shell
$ico = Join-Path $base '鲸鱼娘.ico'
$items = @(
  @{ Name='东方妖妖梦 AI陪玩'; Target='一键开始.vbs'; Desc='桌宠 + 东方妖妖梦 AI 陪玩' },
  @{ Name='鲸鱼娘桌宠';       Target='启动桌宠.vbs'; Desc='只启动鲸鱼娘桌宠' }
)
foreach ($it in $items) {
  $lnk = Join-Path $desktop ($it.Name + '.lnk')
  $s = $ws.CreateShortcut($lnk)
  $s.TargetPath = Join-Path $base $it.Target
  $s.WorkingDirectory = $base
  if (Test-Path $ico) { $s.IconLocation = "$ico,0" }
  $s.Description = $it.Desc
  $s.Save()
  Write-Host ("created: " + $lnk)
}