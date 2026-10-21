@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title Moo-Quest - Cliente Lua / Servidor original
set "GAME_DIR=%~dp0."
rem Resolve server root even if another Node process is already listening.
set "SERVER_ROOT=%~dp0node-runtime"
if defined MOOQUEST_SERVER_DIR set "SERVER_ROOT=%MOOQUEST_SERVER_DIR%"
set "LOVEEXE="
if exist "%~dp0love.exe" set "LOVEEXE=%~dp0love.exe"
if not defined LOVEEXE if exist "%ProgramFiles%\LOVE\love.exe" set "LOVEEXE=%ProgramFiles%\LOVE\love.exe"
if not defined LOVEEXE if exist "%ProgramFiles(x86)%\LOVE\love.exe" set "LOVEEXE=%ProgramFiles(x86)%\LOVE\love.exe"
if not defined LOVEEXE for %%L in (love.exe) do if not "%%~$PATH:L"=="" set "LOVEEXE=%%~$PATH:L"
if not defined LOVEEXE (
 echo [ERRO] Instale LÖVE 2D 11.5 em https://love2d.org/
 pause
 exit /b 1
)
set "SERVER_RUNNING=0"
powershell.exe -NoProfile -Command "try { $r=Invoke-WebRequest -UseBasicParsing -Uri 'http://127.0.0.1:8080/ping' -TimeoutSec 2; if($r.StatusCode -eq 200){exit 0}else{exit 1} } catch { exit 1 }"
if not errorlevel 1 set "SERVER_RUNNING=1"
if "%SERVER_RUNNING%"=="0" (
  where node.exe >nul 2>&1
  if errorlevel 1 (
    echo [ERRO] Node.js 20+ nao encontrado. Se o servidor ja estiver funcionando
    echo em 127.0.0.1:8080, inicie-o separadamente.
    pause
    exit /b 1
  )
  if not exist "!SERVER_ROOT!\server\src\index.js" (
    echo [ERRO] Pasta do servidor original nao encontrada.
    echo Rode PREPARAR-SERVIDOR.bat ou configure MOOQUEST_SERVER_DIR
    echo apontando para uma copia original que voce ja tenha funcionando.
    pause
    exit /b 1
  )
  if exist "!SERVER_ROOT!\server\src\network\nativeBridge.js" (
    echo [ERRO] Copia antiga modificada do servidor encontrada.
    echo Nao vamos usar a nativeBridge. Prepare uma copia ORIGINAL limpa.
    pause
    exit /b 1
  )
  if not exist "!SERVER_ROOT!\server\src\anticheat\config.js" (
    echo.
    echo [ERRO] Arquivo anticheat/config.js ausente.
    echo Execute PREPARAR-SERVIDOR.bat novamente usando o ZIP atualizado.
    echo O preparador corrigira esta copia sem baixar tudo de novo.
    echo.
    pause
    exit /b 1
  )
  if exist "!SERVER_ROOT!\LOCAL-COMPATIBILITY-NOTICE.txt" (
    echo [AVISO] Configuracao anticheat de compatibilidade SOMENTE LOCAL.
    echo O servidor ainda usa integralmente o motor de jogo Node.js original.
  )
  echo Iniciando motor Node original em localhost...
  start "Moo-Quest - Servidor ORIGINAL" /D "!SERVER_ROOT!" cmd /K "set HOST=127.0.0.1&& node server\src\index.js"
) else (
  echo Servidor original ja detectado em 127.0.0.1:8080. Nao vou reinicia-lo.
)
rem Wait for Node to finish loading before opening the Lua client.
rem A successful process launch is NOT evidence the game server is ready.
powershell.exe -NoProfile -Command "$ok=$false; for($i=0;$i -lt 75;$i++){ try { $r=Invoke-RestMethod -Uri 'http://127.0.0.1:8080/ping' -TimeoutSec 1; if($r.status -eq 'ok' -and $r.build){$ok=$true;break} } catch {}; Start-Sleep -Milliseconds 200 }; if($ok){exit 0}else{exit 1}"
if errorlevel 1 (
  echo [ERRO] O servidor Node nao ficou pronto em localhost:8080.
  echo Consulte a janela do servidor. O cliente Lua nao sera iniciado.
  pause
  exit /b 1
)
echo [OK] Node.js respondeu /ping.
rem The client cannot render its original hammer, cows or gear if any PNG
rem is missing. Re-sync original local sprites on EVERY launch.
where node.exe >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado para importar os PNGs originais.
  pause
  exit /b 1
)
echo Verificando os 180 sprites originais em assets\reference\img...
node "%~dp0tools\sync-reference-art.mjs"
if errorlevel 1 (
  echo [ERRO] Nao foi possivel carregar as artes do cliente original.
  echo O arquivo de imagem ausente deve ser corrigido na origem.
  pause
  exit /b 1
)
echo [OK] Sprites copiados. Abrindo cliente Lua...
rem The original Node generates build parameters at startup. A stale or
rem nonexistent MOOQUEST_BUILD_FILE must NEVER open an apparently playable
rem UI that will only block on io-init.
echo Verificando se o build local corresponde ao Node ativo...
set "RESOLVED_BUILD="
for /f "delims=" %%B in ('node "%~dp0tools\resolve-local-build.mjs"') do (
  set "RESOLVED_BUILD=%%B"
)
if not defined RESOLVED_BUILD (
  echo.
  echo [ERRO] Cliente Lua nao encontrou o build do servidor em execucao.
  echo Verifique o erro [BUILD] acima.
  echo Se outro Moo-Quest estiver aberto, feche o Node antigo e tente novamente.
  pause
  exit /b 1
)
set "MOOQUEST_BUILD_FILE=!RESOLVED_BUILD!"
echo [OK] Build original validado: "!MOOQUEST_BUILD_FILE!"
echo Abrindo o cliente Lua, WebSocket ws://127.0.0.1:8080/s/LC ...
"%LOVEEXE%" "%GAME_DIR%"
set "EXITCODE=%ERRORLEVEL%"
if not "%EXITCODE%"=="0" (
  echo [ERRO] Cliente Lua terminou com codigo %EXITCODE%.
  pause
)
exit /b %EXITCODE%
