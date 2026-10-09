param([switch]$CheckOnly)

$ErrorActionPreference = 'Stop'
$projectDirectory = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectDirectory

try {
    foreach ($command in @('node.exe', 'npm.cmd', 'cargo.exe', 'rustc.exe')) {
        if (-not (Get-Command $command -ErrorAction SilentlyContinue)) {
            throw "Missing development tool: $command. Ask the project maintainer to complete setup."
        }
    }
    if (-not (Test-Path -LiteralPath 'node_modules\@tauri-apps\cli\tauri.js')) {
        throw 'Project dependencies are missing. Ask the project maintainer to complete setup.'
    }
    if (Get-Process | Where-Object { $_.ProcessName -match '^chatnote(?:[_.-].*)?$' }) {
        throw 'Close the running ChatNote window first, then double-click the preview launcher again. You do not need to sign out.'
    }
    $listeners = [System.Net.NetworkInformation.IPGlobalProperties]::GetIPGlobalProperties().GetActiveTcpListeners()
    if ($listeners | Where-Object { $_.Port -eq 1420 }) {
        throw 'Preview port 1420 is already in use. Close the earlier preview terminal before starting again.'
    }
    if ($CheckOnly) {
        Write-Host 'ChatNote desktop preview prerequisites passed. No application was started.'
        exit 0
    }
    Write-Host 'Starting ChatNote DEVELOPMENT PREVIEW...'
    Write-Host 'The first launch compiles the desktop application and may take several minutes.'
    Write-Host 'Keep this terminal open. UI edits normally appear automatically.'
    if ($env:CHATNOTE_DATA_DIR) {
        Write-Host 'Using CHATNOTE_DATA_DIR for the database; the system credential vault remains shared.'
    } else {
        Write-Host 'This preview uses your existing ChatNote workspace and system credential vault.'
    }
    Write-Host 'Use only one ChatNote window at a time. No installer or release is created.'
    & npm.cmd run desktop:dev
    exit $LASTEXITCODE
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
