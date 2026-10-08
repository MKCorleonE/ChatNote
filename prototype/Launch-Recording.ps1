$ErrorActionPreference = 'Stop'
$edgeCandidates = @(
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\Application\msedge.exe')
)
$edgeExecutable = $edgeCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $edgeExecutable) { throw 'Microsoft Edge was not found.' }
$recordingProfile = Join-Path $PSScriptRoot '.recording-profile'
$recordingArgs = @(
    '--app="http://127.0.0.1:4173/recording.html"',
    ('--user-data-dir="{0}"' -f $recordingProfile),
    '--window-size=1360,980',
    '--no-first-run',
    '--no-default-browser-check'
)
Start-Process -FilePath $edgeExecutable -ArgumentList $recordingArgs -WindowStyle Normal
