param([string]$Text='Hello!',[string]$Animation='talk',[string]$Event='',[int]$Duration=5000)
$ErrorActionPreference='Stop'
$config=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'config.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($Event) { $message=@{event=$Event} } else { $message=@{text=$Text;animation=$Animation;duration_ms=$Duration} }
$body=[Text.Encoding]::UTF8.GetBytes(($message | ConvertTo-Json -Compress))
Invoke-RestMethod -Uri "http://127.0.0.1:$($config.port)/message" -Method Post -ContentType 'application/json; charset=utf-8' -Body $body
