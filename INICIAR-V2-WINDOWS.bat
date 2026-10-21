@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title Moo-Quest V2 - Teste de compatibilidade
echo Moo-Quest V2 independente - teste local somente
if not exist "%~dp0server-v2\src\index.js" (
  echo [ERRO] server-v2 nao encontrado.
  pause
  exit /b 1
)
where node.exe >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Instale Node.js 22 ou superior.
  pause
  exit /b 1
)
set "LOVEEXE="
if exist "%~dp0love.exe" set "LOVEEXE=%~dp0love.exe"
if not defined LOVEEXE if exist "%ProgramFiles%\LOVE\love.exe" set "LOVEEXE=%ProgramFiles%\LOVE\love.exe"
if not defined LOVEEXE if exist "%ProgramFiles(x86)%\LOVE\love.exe" set "LOVEEXE=%ProgramFiles(x86)%\LOVE\love.exe"
if not defined LOVEEXE for %%L in (love.exe) do if not "%%~$PATH:L"=="" set "LOVEEXE=%%~$PATH:L"
if not defined LOVEEXE (
  echo [ERRO] LÖVE 2D nao encontrado. Instale pelo site love2d.org.
  pause
  exit /b 1
)
if not defined MOO_DATABASE_URL if not exist "%~dp0server-v2\.env" (
  echo [ERRO] Configure server-v2\.env com MOO_DATABASE_URL e MOO_REDIS_URL
  echo ou forneca ambas as variaveis no terminal.
  pause
  exit /b 1
)
if not exist "%~dp0server-v2\node_modules\ws\package.json" (
  echo Instalando dependencias somente do servidor V2...
  pushd "%~dp0server-v2"
  call npm.cmd install --omit=dev --no-audit --no-fund
  if errorlevel 1 (
    popd
    echo [ERRO] Falha em npm install.
    pause
    exit /b 1
  )
  popd
)
powershell.exe -NoProfile -Command "try { $x=Invoke-RestMethod 'http://127.0.0.1:8080/ping' -TimeoutSec 2; if($x.build -eq 'mqv2native'){exit 0}else{exit 2} } catch {exit 1}"
if not errorlevel 1 goto :connected
if errorlevel 2 (
  echo [ERRO] Porta 8080 ja usada por um servidor diferente do V2.
  echo Encerre o servidor antigo; nenhum servidor sera substituido automaticamente.
  pause
  exit /b 1
)
echo Iniciando somente server-v2 em localhost:8080.
set "MOO_HOST=127.0.0.1"
set "MOO_PORT=8080"
set "MOO_PUBLIC_MODE=0"
set "MOO_PUBLIC_HTTPS=0"
set "MOO_TRUST_PROXY=0"
if exist "%~dp0server-v2\.env" (
  start "Moo-Quest V2 Node" /D "%~dp0server-v2" cmd /K "node --env-file=.env bootstrap.js"
) else (
  start "Moo-Quest V2 Node" /D "%~dp0server-v2" cmd /K "node bootstrap.js"
)
powershell.exe -NoProfile -Command "$ok=$false; for($i=0;$i -lt 60;$i++){try{$x=Invoke-RestMethod 'http://127.0.0.1:8080/ping' -TimeoutSec 1;if($x.build -eq 'mqv2native'){$ok=$true;break}}catch{};Start-Sleep -Milliseconds 250};if($ok){exit 0}else{exit 1}"
if errorlevel 1 (
  echo [ERRO] V2 nao iniciou. Confira PostgreSQL, Redis e logs do Node.
  pause
  exit /b 1
)
:connected
echo [OK] API V2 confirmada (build mqv2native).
echo [INFO] Na primeira instalacao, abra http://127.0.0.1:8080/setup
echo [INFO] Este teste NAO baixa nem importa artes do servidor antigo.
set "MOOQUEST_REQUIRE_V2=1"
"%LOVEEXE%" "%~dp0."
set "EXITCODE=%ERRORLEVEL%"
if not "%EXITCODE%"=="0" pause
exit /b %EXITCODE%
