$ErrorActionPreference = 'Stop'
$prototypeFile = Join-Path $PSScriptRoot 'index.html'
if (-not (Test-Path -LiteralPath $prototypeFile)) { throw 'Prototype index.html is missing.' }
$edgeCandidates = @(
    (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe'),
    (Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\Application\msedge.exe')
)
$edgeExecutable = $edgeCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $edgeExecutable) { throw 'Microsoft Edge was not found. Open index.html in a modern browser instead.' }
$prototypeUrl = ([System.Uri]$prototypeFile).AbsoluteUri
$prototypeProfile = Join-Path $PSScriptRoot '.desktop-profile'
$launchArguments = @(
    ('--app="{0}"' -f $prototypeUrl),
    ('--user-data-dir="{0}"' -f $prototypeProfile),
    '--no-first-run',
    '--no-default-browser-check'
)
Start-Process -FilePath $edgeExecutable -ArgumentList $launchArguments -WindowStyle Normal
