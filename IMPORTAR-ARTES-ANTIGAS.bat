@echo off
setlocal
cd /d "%~dp0"
title Moo-Quest - recuperar artes PNG da versao anterior
where node.exe >nul 2>nul
if errorlevel 1 (
 echo [ERRO] Node.js 22+ nao encontrado.
 pause
 exit /b 1
)
echo.
echo Informe a pasta do cliente antigo que contem as artes PNG.
echo Exemplo: C:\Users\Usuario\Downloads\MooQuest-antigo
echo Nada sera excluido ou sobrescrito.
echo.
set "PASTA_ANTIGA="
set /p "PASTA_ANTIGA=Pasta antiga: "
if not defined PASTA_ANTIGA (
 echo [ERRO] Nenhuma pasta informada.
 pause
 exit /b 1
)
node "%~dp0tools\importar-artes-antigas.mjs" "%PASTA_ANTIGA%"
set "RESULT=%ERRORLEVEL%"
echo.
if "%RESULT%"=="0" (
 echo [Moo-Quest] Abra JOGAR-V2-ONLINE-WINDOWS.bat para testar.
) else (
 echo [ERRO] Nao foi possivel importar. Veja as mensagens.
)
pause
exit /b %RESULT%
