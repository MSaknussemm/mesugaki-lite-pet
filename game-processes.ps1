$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
# Query process paths without requiring WMI/CIM access or administrator privileges.
# An inaccessible path is kept as null, never treated as proof that the game exited.
$rows = @([Diagnostics.Process]::GetProcessesByName('th07_multi') | ForEach-Object {
    $gameProcess = $_
    $executablePath = $null
    try { $executablePath = $gameProcess.MainModule.FileName } catch { }
    @{ Pid = $gameProcess.Id; Path = $executablePath }
    $gameProcess.Dispose()
})
ConvertTo-Json -InputObject $rows -Compress
