@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Moo-Quest - Lua + LOVE 2D

set "LOVEEXE="
if exist "%~dp0love.exe" set "LOVEEXE=%~dp0love.exe"
if not defined LOVEEXE if exist "%ProgramFiles%\LOVE\love.exe" set "LOVEEXE=%ProgramFiles%\LOVE\love.exe"
if not defined LOVEEXE if exist "%ProgramFiles(x86)%\LOVE\love.exe" set "LOVEEXE=%ProgramFiles(x86)%\LOVE\love.exe"
if not defined LOVEEXE (
  for %%L in (love.exe) do if not "%%~$PATH:L"=="" set "LOVEEXE=%%~$PATH:L"
)
if not defined LOVEEXE (
  echo.
  echo [ERRO] LOVE 2D nao encontrado.
  echo Instale o LOVE 2D 11.5 em https://love2d.org/
  echo Ou coloque o love.exe e as DLLs oficiais ao lado deste arquivo.
  echo.
  pause
  exit /b 1
)
if not exist "%~dp0main.lua" (
  echo [ERRO] main.lua nao encontrado na pasta do jogo.
  pause
  exit /b 1
)
echo Iniciando Moo-Quest com: "%LOVEEXE%"
echo Pasta do jogo: "%CD%"
echo Rede local: 127.0.0.1:17017 (TCP)
"%LOVEEXE%" "%~dp0"
set "EXITCODE=%ERRORLEVEL%"
if not "%EXITCODE%"=="0" (
  echo.
  echo [ERRO] O cliente terminou com codigo %EXITCODE%.
  echo Confira o erro exibido e consulte docs\EXECUTAR-LOCAL.md.
  pause
)
exit /b %EXITCODE%
