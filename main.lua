-- Moo-Quest is a Lua client for the UNMODIFIED al007ex/moomoo-clone server.
-- Current milestone is real server discovery + WebSocket + io-init diagnostics.
-- We intentionally do NOT draw a fake world or claim an authenticated session.
local Original=require("src.net.original_client")
local client=nil
local diagnostic=nil
local reconnectSeconds=0
local latestEvent="Nenhum io-init recebido."
local startupError=nil

function love.load()
  love.graphics.setDefaultFilter("nearest","nearest")
  if os.getenv("MOOQUEST_TESTS")=="1" then
    diagnostic=require("src.test_runner").run()
    return
  end
  local ok,result=pcall(Original.new,{host="127.0.0.1",port=8080,server="LC"})
  if not ok then
    startupError="Falha ao inicializar cliente de rede: "..tostring(result)
    return
  end
  client=result
  local connected,err=client:connect()
  if not connected then startupError=err end
end

function love.update(dt)
  if diagnostic or not client then return end
  client:update()
  for _,evt in ipairs(client:drain()) do
    if evt.kind=="io-init" then
      local h=evt.data
      latestEvent=string.format("io-init: keyed=%d, pinned=%s, sealMode=%d",
        h.mode,tostring(h.pinned),h.sealMode)
    end
  end
  if client.state=="failed" or client.state=="closed" then
    reconnectSeconds=reconnectSeconds+dt
    -- Do not hammer the original server's connection limit or ban policy.
    -- Retry only when explicitly requested by pressing R.
  end
end

local function line(y,text,color)
  if color then love.graphics.setColor(color) else love.graphics.setColor(0.88,0.93,0.89) end
  love.graphics.print(text,36,y)
end

function love.draw()
  love.graphics.clear(0.075,0.11,0.10)
  if diagnostic then
    line(28,"MOO-QUEST | TESTES DO CLIENTE LUA")
    line(66,string.format("Aprovados: %d   Falhas: %d",diagnostic.passed,diagnostic.failed))
    for i,r in ipairs(diagnostic.rows) do
      line(92+i*27,(r.pass and "OK   " or "ERRO ")..r.path,
        r.pass and {0.45,0.86,0.56} or {1,0.55,0.5})
      if not r.pass then
        love.graphics.setColor(1,0.75,0.64)
        love.graphics.printf(tostring(r.error):gsub("%s+"," "):sub(1,125),
          395,92+i*27,850)
      end
    end
    line(585,"Relatorio: "..tostring(diagnostic.reportPath or diagnostic.reportError or "nao gravado"))
    line(626,"ESC: sair")
    return
  end
  local w,h=love.graphics.getDimensions()
  love.graphics.setColor(0.12,0.18,0.15)
  love.graphics.rectangle("fill",18,18,w-36,h-36,10,10)
  love.graphics.setColor(0.81,0.91,0.80)
  love.graphics.print("MOO-QUEST | CLIENTE LUA / LOVE 2D",36,36,0,1.6)
  love.graphics.setColor(0.28,0.40,0.33)
  love.graphics.rectangle("fill",36,82,w-72,2)
  line(107,"Servidor ORIGINAL: al007ex/moomoo-clone (sem modificacoes)")
  line(144,"Endereco: http://127.0.0.1:8080  |  Jogo: LC  |  Transporte: WebSocket original")
  if startupError then
    love.graphics.setColor(1,0.65,0.46)
    love.graphics.printf(tostring(startupError),36,197,w-72)
  elseif client then
    love.graphics.setColor(0.88,0.90,0.72)
    love.graphics.printf(client.status or "Conectando...",36,197,w-72)
    if client.build then line(257,"Build do servidor: "..tostring(client.build)) end
  end
  line(310,latestEvent)
  love.graphics.setColor(1,0.78,0.54)
  love.graphics.printf("A partida ainda NAO esta autenticada. O servidor exige "..
    "identificacao do build, ticket de entrada, protocolo binario com chave e "..
    "verificacoes de integridade. Esses requisitos ainda precisam de suporte "..
    "legitimo no cliente Lua. A janela aberta NAO significa jogo funcionando.",
    36,368,w-72)
  love.graphics.setColor(0.67,0.77,0.71)
  love.graphics.printf("R: tentar novamente   |   ESC: sair\n"..
    "Servidor original em Node.js; nenhuma simulacao Lua, ponte TCP ou alteracao do servidor.",
    36,h-115,w-72)
end

function love.keypressed(key)
  if key=="escape" then love.event.quit();return end
  if diagnostic then return end
  if key=="r" and client then
    reconnectSeconds=0
    startupError=nil
    local ok,err=client:connect()
    if not ok then startupError=err end
  end
end
function love.quit()
  if client then client:close() end
end
