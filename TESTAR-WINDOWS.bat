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
echo Abrindo testes dos modulos do cliente Lua...
"%LOVEEXE%" "%GAME_DIR%"
set "EXITCODE=%ERRORLEVEL%"
if not "%EXITCODE%"=="0" (
 echo [ERRO] O testador terminou com erro.
 pause
)
exit /b %EXITCODE%
