@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Moo-Quest - Testar cliente Lua
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
set "MOOQUEST_TESTS=1"
set "MOOQUEST_TESTS_EXIT=1"
echo Executando testes Lua. O comando encerra automaticamente ao terminar.
echo Se algum teste falhar, o arquivo BAT retornara erro em vez de OK falso.
"%LOVEEXE%" "%GAME_DIR%"
set "EXITCODE=%ERRORLEVEL%"
set "TEST_REPORT=%APPDATA%\LOVE\moo_quest\test-results.txt"
if exist "%TEST_REPORT%" (
 copy /Y "%TEST_REPORT%" "%~dp0RELATORIO-TESTES-LUA.txt" >nul
 echo Relatorio salvo em: "%~dp0RELATORIO-TESTES-LUA.txt"
) else (
 echo [AVISO] Nao foi encontrado um relatorio de testes.
 echo Se LÖVE abriu um erro de Lua, copie a mensagem exibida na janela.
)
if not "%EXITCODE%"=="0" (
 echo [ERRO] Pelo menos um teste Lua falhou ou o LÖVE encerrou com erro.
 echo O relatorio detalhado fica na pasta de dados moo_quest do LÖVE.
 pause
) else (
 echo [OK] Todos os testes executados pelo LÖVE foram aprovados.
)
exit /b %EXITCODE%
