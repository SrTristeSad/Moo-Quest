@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Moo-Quest - Teste com SERVIDOR 1 (original)
echo.
echo =============================================================
echo Moo-Quest ^| CLIENTE LUA + SERVIDOR 1 (server/src/index.js)
echo =============================================================
echo.
echo Este teste NAO utiliza server-v2, PostgreSQL ou Redis.
echo A engine Node original sera executada localmente na porta 8080.
echo.
if not exist "%~dp0server\src\index.js" (
  echo [ERRO] Servidor 1 nao incluido. Baixe o pacote completo.
  pause
  exit /b 1
)
if not exist "%~dp0server\src\anticheat\config.js" (
  echo [ERRO] Arquivo do servidor 1 ausente.
  pause
  exit /b 1
)
rem For this test, never honor a stale alternate Node runtime directory.
set "MOOQUEST_SERVER_DIR=%~dp0"
rem The original server uses a generated protocol build rather than the V2 build.
set "MOOQUEST_REQUIRE_V2="
rem Do not reuse a generated protocol file from another installation.
set "MOOQUEST_BUILD_FILE="
call "%~dp0INICIAR-WINDOWS.bat"
set "RESULT=%ERRORLEVEL%"
if not "%RESULT%"=="0" (
  echo.
  echo [ERRO] O teste terminou com erro %RESULT%.
  echo Copie a mensagem da janela e envie para diagnostico.
  pause
)
exit /b %RESULT%
