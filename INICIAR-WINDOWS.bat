@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Moo-Quest - Lua cliente + servidor original Node.js
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
 echo [ERRO] Node.js 20+ nao encontrado.
 pause
 exit /b 1
)
if not exist "%~dp0node-runtime\server\src\index.js" (
 echo [ERRO] Servidor original nao foi instalado.
 echo Execute PREPARAR-SERVIDOR.bat primeiro.
 pause
 exit /b 1
)
if exist "%~dp0node-runtime\server\src\network\nativeBridge.js" (
 echo [ERRO] Detectada copia antiga MODIFICADA do servidor (nativeBridge.js).
 echo Renomeie node-runtime e execute PREPARAR-SERVIDOR.bat.
 echo Nao vamos usar pontes no servidor.
 pause
 exit /b 1
)
if not exist "%~dp0node-runtime\server\src\anticheat\config.js" (
 echo.
 echo [BLOQUEIO NA REFERENCIA ORIGINAL]
 echo O arquivo server\src\anticheat\config.js nao esta no commit original
 echo mas e importado por server\src\anticheat\index.js.
 echo Nao vou modificar o servidor. Precisamos de uma versao original completa.
 echo Consulte docs\EXECUTAR-LOCAL.md.
 echo.
 pause
 exit /b 1
)
echo Iniciando o servidor original sem nenhuma alteracao...
start "Moo-Quest - Servidor ORIGINAL Node.js" /D "%~dp0node-runtime" cmd /K "node server\src\index.js"
echo Abrindo somente o cliente Lua via WebSocket original ws://127.0.0.1:8080/s/LC
"%LOVEEXE%" "%GAME_DIR%"
set "EXITCODE=%ERRORLEVEL%"
if not "%EXITCODE%"=="0" (
 echo.
 echo [ERRO] Cliente Lua terminou com codigo %EXITCODE%.
 pause
)
exit /b %EXITCODE%
