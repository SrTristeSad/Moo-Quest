@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Moo-Quest - Teste cliente Lua / servidor Node.js

where node.exe >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Instale Node.js 20 ou superior: https://nodejs.org/
  pause
  exit /b 1
)
if not exist "%~dp0node-runtime\server\node_modules\msgpack-lite" (
  echo [ERRO] Dependencias do servidor nao encontradas.
  echo Execute PREPARAR-SERVIDOR.bat primeiro.
  pause
  exit /b 1
)
echo.
echo O servidor Node.js precisa estar aberto, com a porta 17017 em uso.
echo Se estiver fechado, execute INICIAR-WINDOWS.bat primeiro.
echo.
node "%~dp0tools\check-node-connection.mjs"
set "EXITCODE=%ERRORLEVEL%"
echo.
if not "%EXITCODE%"=="0" (
  echo [ERRO] O teste de integracao falhou; copie as mensagens acima.
) else (
  echo [OK] Spawn e movimento foram confirmados pelo servidor Node original.
)
pause
exit /b %EXITCODE%
