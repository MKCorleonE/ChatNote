@echo off
title ChatNote Development Preview
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-desktop-preview.ps1"
if errorlevel 1 pause
