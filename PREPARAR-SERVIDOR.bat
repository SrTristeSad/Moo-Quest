@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Moo-Quest - Preparar servidor original Node.js
where node.exe >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Node.js 20 ou superior nao foi encontrado.
  echo Instale Node.js LTS em https://nodejs.org/ e execute novamente.
  pause
  exit /b 1
)
where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo [ERRO] npm nao encontrado. Reinstale Node.js com npm.
  pause
  exit /b 1
)
echo Preparando o servidor Node.js reconstruido da referencia.
echo Se o servidor ja foi baixado, a pasta node-runtime sera reutilizada.
echo Corrigindo automaticamente o arquivo de configuracao ausente.
echo Internet sera necessaria para dependencias npm se nao instaladas.
echo.
node "%~dp0tools\prepare-node-server.mjs"
set "EXITCODE=%ERRORLEVEL%"
if not "%EXITCODE%"=="0" (
  echo.
  echo [ERRO] Falha ao preparar o servidor Node.js.
  echo Copie toda a mensagem do console para diagnostico.
  pause
  exit /b %EXITCODE%
)
echo.
echo [OK] Servidor Node original passou no teste de inicializacao e HTTP /ping.
echo Observacao: o cliente Lua ainda esta em desenvolvimento.
echo Agora execute INICIAR-WINDOWS.bat para testar a conexao.
pause
exit /b 0
