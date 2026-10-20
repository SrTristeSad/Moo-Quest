@echo off
setlocal
cd /d "%~dp0"
title Moo-Quest - Verificar ticket do servidor Node original
where node.exe >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado.
  pause
  exit /b 1
)
echo.
echo Verificando /ping, ticket REAL de /api/join e handshake WebSocket...
echo O servidor original precisa estar rodando em 127.0.0.1:8080.
echo.
node "%~dp0tools\check-node-join.mjs"
set "RESULT=%ERRORLEVEL%"
echo.
if "%RESULT%"=="0" (
  echo [OK] O servidor aceitou o ticket e enviou io-init.
  echo Isto NAO comprova spawn nem jogabilidade Lua.
) else (
  echo [ERRO] A verificacao real de entrada falhou.
)
pause
exit /b %RESULT%
