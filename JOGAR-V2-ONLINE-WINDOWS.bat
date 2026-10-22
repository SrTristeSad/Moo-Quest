@echo off
setlocal
cd /d "%~dp0"
title Moo-Quest V2 ONLINE - app.snusnu.com.br
where node.exe >nul 2>nul
if errorlevel 1 (
  echo [ERRO] Node.js 22+ nao encontrado. Instale pelo site oficial nodejs.org.
  pause
  exit /b 1
)
node "%~dp0tools\run-v2-online.mjs"
set "RESULT=%ERRORLEVEL%"
if not "%RESULT%"=="0" (
  echo.
  echo [ERRO] Cliente nao iniciou. Confira as mensagens acima.
  pause
)
exit /b %RESULT%
