# Moo-Quest V2 Windows launcher: Node TLS bridge + LÖVE client.
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$relayScript = Join-Path $root 'tools\v2-https-relay.mjs'
$relay = $null

function Find-Love {
  $pf86 = [Environment]::GetEnvironmentVariable('ProgramFiles(x86)')
  $paths = @((Join-Path $root 'love.exe'),(Join-Path $env:ProgramFiles 'LOVE\love.exe'))
  if ($pf86) { $paths += (Join-Path $pf86 'LOVE\love.exe') }
  foreach ($candidate in $paths) {
    if ($candidate -and (Test-Path -LiteralPath $candidate)) { return $candidate }
  }
  $command = Get-Command love.exe -ErrorAction SilentlyContinue
  if ($command) { return $command.Source }
  throw 'LÖVE 2D nao encontrado. Instale pelo love2d.org ou coloque love.exe na pasta do jogo.'
}

try {
  $node = Get-Command node.exe -ErrorAction Stop
  $major = [int]((& $node.Source -p 'process.versions.node.split(".")[0]').Trim())
  if ($major -lt 22) { throw 'Node.js 22 ou superior necessario no Windows.' }
  if (-not (Test-Path -LiteralPath $relayScript)) { throw 'Ponte HTTPS/WSS nao incluida neste cliente.' }
  $love = Find-Love

  # Refuse to hijack another localhost program on the game port.
  $tcp = [Net.Sockets.TcpClient]::new()
  try {
    $check = $tcp.BeginConnect('127.0.0.1',8080,$null,$null)
    if ($check.AsyncWaitHandle.WaitOne(200)) {
      try { $tcp.EndConnect($check); throw 'A porta 8080 esta em uso. Feche o servidor/cliente local antigo.' }
      catch [Net.Sockets.SocketException] {}
    }
  } finally { $tcp.Close() }

  Write-Host '[Moo-Quest] Conectando a app.snusnu.com.br por TLS verificado...'
  $relay = Start-Process -FilePath $node.Source -ArgumentList @('"' + $relayScript + '"') -PassThru -NoNewWindow
  $ready = $false
  for ($i=0; $i -lt 16; $i++) {
    Start-Sleep -Milliseconds 600
    if ($relay.HasExited) { throw 'A ponte HTTPS/WSS encerrou antes de iniciar.' }
    try {
      $ping = Invoke-RestMethod 'http://127.0.0.1:8080/ping' -TimeoutSec 3
      if ($ping.build -eq 'mqv2native') { $ready = $true; break }
      throw 'O dominio respondeu com um servidor inesperado (build diferente).'
    } catch {
      if ($_.Exception.Message -like '*servidor inesperado*') { throw }
    }
  }
  if (-not $ready) {
    throw 'Nao foi possivel confirmar a API V2 HTTPS em app.snusnu.com.br. Verifique SSL, proxy aaPanel e /ping.'
  }
  Write-Host '[Moo-Quest] API V2 confirmada. Abrindo cliente...'
  $env:MOOQUEST_REQUIRE_V2='1'
  $env:MOOQUEST_V2_ONLINE='1'
  $env:MOOQUEST_REMOTE_ADDRESS='app.snusnu.com.br'
  $p = Start-Process -FilePath $love -ArgumentList @('"' + $root + '"') -Wait -PassThru
  exit $p.ExitCode
} catch {
  Write-Host ('[ERRO] ' + $_.Exception.Message) -ForegroundColor Red
  Read-Host 'Pressione ENTER para fechar'
  exit 1
} finally {
  if ($relay -and -not $relay.HasExited) {
    Stop-Process -Id $relay.Id -Force -ErrorAction SilentlyContinue
  }
}
