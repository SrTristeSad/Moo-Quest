@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Moo-Quest - Preparar NOSSO servidor Node
where node.exe >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Node.js LTS nao encontrado.
  pause
  exit /b 1
)
where npm.cmd >nul 2>&1
if errorlevel 1 (
  echo [ERRO] npm nao encontrado. Reinstale Node.js LTS.
  pause
  exit /b 1
)
if not exist "%~dp0server\src\index.js" (
  echo [ERRO] Codigo do servidor nao veio junto no ZIP do Moo-Quest.
  echo Baixe a versao atual de SrTristeSad/Moo-Quest.
  pause
  exit /b 1
)
echo [1/3] Preservando LOCALMENTE as contas e o build da instalacao antiga...
node "%~dp0tools\migrate-local-server-data.mjs"
if errorlevel 1 (
  echo [ERRO] Nao foi possivel migrar os dados. Nenhum original foi apagado.
  pause
  exit /b 1
)
echo [2/3] Instalando dependencias do servidor Node do NOSSO GitHub...
call npm.cmd install --omit=dev --no-audit --no-fund
if errorlevel 1 (
  echo [ERRO] Falha ao instalar dependencias npm.
  pause
  exit /b 1
)
node --check server\src\index.js
if errorlevel 1 (
  echo [ERRO] O servidor Node contem erros de sintaxe.
  pause
  exit /b 1
)
echo [OK] Motor de jogo e coleta normal preparados.
echo [3/3] Conferindo imagens locais. PNGs quebrados do upstream serao rejeitados...
node "%~dp0tools\sync-reference-art.mjs"
if errorlevel 1 (
  echo.
  echo [ARTE] O servidor esta instalado, mas faltam sprites validos.
  echo Consulte ARTES-PENDENTES.txt. O martelo original no upstream e INVALIDO.
  echo Coloque seu arquivo PNG em assets\custom\img\weapons\hammer_1.png
  echo O Moo-Quest NAO vai gerar uma imagem diferente ou fingir que existe.
  pause
  exit /b 1
)
echo [OK] Servidor proprio e artes verificadas.
echo Execute INICIAR-WINDOWS.bat para jogar.
pause
exit /b 0
