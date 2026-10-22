@echo off
setlocal
cd /d "%~dp0"
title Moo-Quest V2 ONLINE - app.snusnu.com.br
powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\run-v2-online.ps1"
exit /b %errorlevel%
