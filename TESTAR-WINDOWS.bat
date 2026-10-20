@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Moo-Quest - Diagnostico de Lua/Love
set "LOVEEXE="
if exist "%~dp0love.exe" set "LOVEEXE=%~dp0love.exe"
if not defined LOVEEXE if exist "%ProgramFiles%\LOVE\love.exe" set "LOVEEXE=%ProgramFiles%\LOVE\love.exe"
if not defined LOVEEXE if exist "%ProgramFiles(x86)%\LOVE\love.exe" set "LOVEEXE=%ProgramFiles(x86)%\LOVE\love.exe"
if not defined LOVEEXE for %%L in (love.exe) do if not "%%~$PATH:L"=="" set "LOVEEXE=%%~$PATH:L"
if not defined LOVEEXE (
 echo [ERRO] LOVE 2D 11.5 nao encontrado. Instale-o em https://love2d.org/
 pause
 exit /b 1
)
set "MOOQUEST_TESTS=1"
echo Abrindo o painel de testes do Moo-Quest...
"%LOVEEXE%" "%~dp0"
if errorlevel 1 (
 echo [ERRO] O testador terminou com erro. Verifique a janela ou o console.
 pause
 exit /b 1
)
echo Testador finalizado. Resultados ficam na pasta de dados do LOVE, identity moo_quest.
exit /b 0
