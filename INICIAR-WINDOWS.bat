@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
title Moo-Quest - Cliente Lua / Servidor original
set "GAME_DIR=%~dp0."
rem The reconstructed Node server is NOW versioned in our own GitHub repo.
rem Do not silently use the downloaded old sandbox server with 1,000,000 funds.
set "SERVER_ROOT=%~dp0."
if defined MOOQUEST_SERVER_DIR set "SERVER_ROOT=%MOOQUEST_SERVER_DIR%"
if not exist "!SERVER_ROOT!\server\src\index.js" (
  echo [ERRO] Servidor proprio nao encontrado. Use o ZIP mais recente.
  pause
  exit /b 1
)
set "MOOQUEST_SERVER_DIR=!SERVER_ROOT!"
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
if "%SERVER_RUNNING%"=="1" (
  powershell.exe -NoProfile -Command "try { $s=Invoke-RestMethod 'http://127.0.0.1:8080/mooquest/status' -TimeoutSec 2; if($s.project -eq 'Moo-Quest' -and $s.economy -eq 'gather'){exit 0}else{exit 1} } catch { exit 1 }"
  if errorlevel 1 (
    echo [ERRO] A porta 8080 esta ocupada por um servidor ANTIGO ou incorreto.
    echo Feche a janela antiga do Node. O Moo-Quest agora possui servidor proprio
    echo e comeca com 0 recursos para coletar de verdade.
    pause
    exit /b 1
  )
)
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
  rem Preserve account state locally; never upload it into public GitHub.
  node "%~dp0tools\migrate-local-server-data.mjs"
  if errorlevel 1 (
    echo [ERRO] Falha na migracao local. Seus dados originais nao foram apagados.
    pause
    exit /b 1
  )
  if not exist "!SERVER_ROOT!\node_modules\ws\package.json" (
    where npm.cmd >nul 2>&1
    if errorlevel 1 (
      echo [ERRO] NPM ausente. Reinstale Node.js LTS.
      pause
      exit /b 1
    )
    echo Instalando dependencias do nosso servidor Node pela primeira vez...
    pushd "!SERVER_ROOT!"
    call npm.cmd install --omit=dev --no-audit --no-fund
    set "INSTALL_CODE=!ERRORLEVEL!"
    popd
    if not "!INSTALL_CODE!"=="0" (
      echo [ERRO] NPM nao preparou o servidor proprio.
      pause
      exit /b 1
    )
  )
  echo Iniciando servidor Node do Moo-Quest com coleta normal...
  start "Moo-Quest - Servidor PROPRIO" /D "!SERVER_ROOT!" cmd /K "set HOST=127.0.0.1&& node server\src\index.js"
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
powershell.exe -NoProfile -Command "try { $s=Invoke-RestMethod 'http://127.0.0.1:8080/mooquest/status' -TimeoutSec 2; if($s.project -eq 'Moo-Quest' -and $s.economy -eq 'gather'){exit 0}else{exit 1} } catch { exit 1 }"
if errorlevel 1 (
  echo [ERRO] O Node em execucao NAO e o nosso servidor de coleta normal.
  echo Feche servidores antigos e tente novamente.
  pause
  exit /b 1
)
echo [OK] Node.js respondeu /ping.
echo [OK] Servidor proprio identificado; recursos inicializados em ZERO.
rem The client cannot render its original hammer, cows or gear if any PNG
rem is missing. Re-sync original local sprites on EVERY launch.
where node.exe >nul 2>&1
if errorlevel 1 (
  echo [ERRO] Node.js nao encontrado para importar os PNGs originais.
  pause
  exit /b 1
)
echo Verificando o conversor local de arquivos WebP com nome PNG...
if not exist "%~dp0node_modules\sharp\package.json" (
  echo Instalando ferramentas para converter WebP sem mudar as imagens...
  call npm.cmd install --omit=dev --no-audit --no-fund
  if errorlevel 1 (
    echo [ERRO] NPM nao conseguiu instalar o conversor de imagens.
    pause
    exit /b 1
  )
)
if not exist "%~dp0node_modules\adm-zip\package.json" (
  echo Instalando extrator de imagens da referencia...
  call npm.cmd install --omit=dev --no-audit --no-fund
  if errorlevel 1 (
    echo [ERRO] NPM nao conseguiu instalar o leitor ZIP.
    pause
    exit /b 1
  )
)
echo Verificando imagens originais, procurando em pastas locais e recuperando as ausentes...
echo [ARTE] Arquivos WebP chamados .png serao convertidos para PNG real automaticamente.
node "%~dp0tools\sync-reference-art.mjs"
if errorlevel 1 (
  echo [ARTE] Nao foi possivel recuperar todos os arquivos necessarios.
  echo Veja o motivo EXATO no ARTES-PENDENTES.txt.
  echo Se voce ja tem as imagens em outra pasta, defina MOOQUEST_ART_SOURCE_DIR.
  pause
  exit /b 1
)
echo [OK] Sprites validos e convertidos. Abrindo cliente Lua...
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
