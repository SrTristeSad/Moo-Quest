@echo off
setlocal
cd /d "%~dp0"
title Moo-Quest - Validar spawn REAL do servidor Node
where node.exe >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado.
  pause
  exit /b 1
)
echo.
echo TESTE DO SERVIDOR ORIGINAL - LOCALHOST
echo O servidor Node deve estar rodando em 127.0.0.1:8080.
echo Este teste cria e desconecta um personagem de teste autentico.
echo Nao e um teste do cliente Lua nem de fidelidade grafica.
echo.
node "%~dp0tools\check-node-spawn.mjs"
set "RESULT=%ERRORLEVEL%"
echo.
if "%RESULT%"=="0" (
  echo [OK] O Node original aceitou o pacote M e confirmou o spawn C.
  echo Agora execute INICIAR-WINDOWS.bat para verificar o cliente Lua.
) else (
  echo [ERRO] O proprio servidor Node ainda nao concluiu um spawn.
  echo Veja a mensagem acima para identificar o bloqueio real.
)
pause
exit /b %RESULT%
