@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Start-Prototype.ps1"
if errorlevel 1 pause
