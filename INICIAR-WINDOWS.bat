@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Moo-Quest - Cliente Lua + Servidor Node.js
set "GAME_DIR=%~dp0."
set "LOVEEXE="
if exist "%~dp0love.exe" set "LOVEEXE=%~dp0love.exe"
if not defined LOVEEXE if exist "%ProgramFiles%\LOVE\love.exe" set "LOVEEXE=%ProgramFiles%\LOVE\love.exe"
if not defined LOVEEXE if exist "%ProgramFiles(x86)%\LOVE\love.exe" set "LOVEEXE=%ProgramFiles(x86)%\LOVE\love.exe"
if not defined LOVEEXE for %%L in (love.exe) do if not "%%~$PATH:L"=="" set "LOVEEXE=%%~$PATH:L"
if not defined LOVEEXE (
  echo [ERRO] LÖVE 2D 11.5 nao encontrado. Instale em https://love2d.org/
  pause
  exit /b 1
)
where node.exe >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Node.js 20 ou superior nao encontrado.
  pause
  exit /b 1
)
if not exist "%~dp0node-runtime\server\src\network\nativeBridge.js" (
  echo.
  echo [ERRO] Servidor Node.js ainda nao foi preparado.
  echo Execute PREPARAR-SERVIDOR.bat uma vez e depois abra este arquivo.
  echo.
  pause
  exit /b 1
)
if not exist "%~dp0node-runtime\server\node_modules\msgpack-lite" (
  echo [ERRO] Dependencias Node.js ausentes. Execute PREPARAR-SERVIDOR.bat.
  pause
  exit /b 1
)
echo Servidor original: Node.js, HTTP localhost:8080
echo Conexao Lua: 127.0.0.1:17017, protocolo nativo local.
echo Abrindo servidor Node.js em outra janela...
start "Moo-Quest - Node.js (feche para desligar servidor)" /D "%~dp0node-runtime" cmd /K "node server\src\index.js"
echo Iniciando cliente Lua...
"%LOVEEXE%" "%GAME_DIR%"
set "EXITCODE=%ERRORLEVEL%"
if not "%EXITCODE%"=="0" (
  echo.
  echo [ERRO] Cliente LÖVE terminou com codigo %EXITCODE%.
  echo Envie o erro da tela e do console Node.js.
  pause
  exit /b %EXITCODE%
)
echo Jogo encerrado. Se quiser desligar o servidor Node.js, feche a janela dele.
exit /b 0
