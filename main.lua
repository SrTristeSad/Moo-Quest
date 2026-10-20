-- Moo-Quest is a Lua client for the UNMODIFIED al007ex/moomoo-clone server.
-- Current milestone is real server discovery + WebSocket + io-init diagnostics.
-- We intentionally do NOT draw a fake world or claim an authenticated session.
local Original=require("src.net.original_client")
local World=require("src.game.world_state")
local View=require("src.game.reference_view")
local Hud=require("src.game.reference_hud")
local Assets=require("src.game.reference_assets")
local Camera=require("src.camera")
local Input=require("src.input")
local Pack=require("src.protocol.msgpack")
local client=nil
local world=World.new()
local camera=nil
local diagnostic=nil
local reconnectSeconds=0
local latestEvent="Nenhum io-init recebido."
local startupError=nil
local input=Input.new()
local movementClock=0
local lastMove=false
local lastAim=nil
local playerX,playerY=nil,nil
local serverPackets=0
local died=false
local heartbeatClock=0
local frameDelta=0

function love.load()
  love.graphics.setDefaultFilter("linear","linear")
  camera=Camera.new()
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

local function angle(y,x)
  if math.atan2 then return math.atan2(y,x) end
  if x>0 then return math.atan(y/x) end
  if x<0 then return math.atan(y/x)+(y>=0 and math.pi or -math.pi) end
  if y>0 then return math.pi/2 end
  if y<0 then return -math.pi/2 end
  return 0
end

function love.update(dt)
  frameDelta=dt
  if diagnostic or not client then return end
  client:update()
  for _,evt in ipairs(client:drain()) do
    if evt.kind=="io-init" then
      local h=evt.data
      latestEvent=string.format("io-init REAL: keyed=%d, pinned=%s, sealMode=%d",
        h.mode,tostring(h.pinned),h.sealMode)
    elseif evt.kind=="game_packet" then
      local packet=evt.data
      world:apply(packet.name,packet.args)
      serverPackets=serverPackets+1
      if packet.name=="C" then
        latestEvent="SPAWN CONFIRMADO pelo Node original. SID "..tostring(client.sid)
        movementClock=0
        lastMove=false
        lastAim=nil
        died=false
      elseif packet.name=="a" and client.sid then
        -- The original server transmits [sid,x,y,dir*100] per visible player.
        local positions=packet.args[1]
        if type(positions)=="table" then
          for i=1,#positions-3,4 do
            if positions[i]==client.sid then
              playerX,playerY=positions[i+1],positions[i+2]
              break
            end
          end
        end
      elseif packet.name=="P" then
        died=true
        latestEvent="Morte confirmada pelo Node. Pressione R para reaparecer."
      elseif packet.name=="B" then
        latestEvent="Servidor recusou partida: "..tostring(packet.args[1])
      end
    end
  end
  world:update(dt)
  local localPlayer=world:localPlayer()
  if localPlayer and localPlayer.x and localPlayer.y and camera then
    camera:followReference(localPlayer.visualX or localPlayer.x,
      localPlayer.visualY or localPlayer.y,dt)
  end
  if client.state=="spawn_confirmed" and not died then
    heartbeatClock=heartbeatClock+dt
    if heartbeatClock>=15 then
      heartbeatClock=0
      client:send("0",{})
    end
    input:update(dt)
    movementClock=movementClock+dt
    if movementClock>=0.07 then
      movementClock=0
      local dx,dy=input.dx,input.dy
      local move=(dx~=0 or dy~=0) and angle(dy,dx) or false
      if move~=lastMove then
        client:send("9",{move==false and Pack.null or move})
        lastMove=move
      end
      local w,h=love.graphics.getDimensions()
      local mx,my=love.mouse.getPosition()
      local aim=angle(my-h/2,mx-w/2)
      if not lastAim or math.abs(aim-lastAim)>0.02 then
        client:send("D",{aim})
        lastAim=aim
      end
    end
  end
  if client.state=="failed" or client.state=="closed" then
    reconnectSeconds=reconnectSeconds+dt
    -- Retry only on explicit R to avoid connection-throttling.
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
  local p=world:localPlayer()
  if client and client.state=="spawn_confirmed" and not died
    and p and p.x and p.y then
    View.draw(world,camera,frameDelta)
    Hud.draw(world)
    -- When a reference PNG is absent, report the missing local source.
    -- Never substitute a generated image or fabricated gameplay entity.
    if #Assets.missing()>0 then
      love.graphics.setColor(0,0,0,0.7)
      love.graphics.rectangle("fill",12,12,520,40,4,4)
      love.graphics.setColor(1,0.82,0.62)
      love.graphics.print("Artes originais ausentes: execute PREPARAR-SERVIDOR.bat",20,23)
    end
    return
  end
  love.graphics.setColor(0.12,0.18,0.15)
  love.graphics.rectangle("fill",18,18,w-36,h-36,10,10)
  love.graphics.setColor(0.81,0.91,0.80)
  love.graphics.print("MOO-QUEST | CLIENTE LUA / LOVE 2D",36,36,0,1.6)
  love.graphics.setColor(0.28,0.40,0.33)
  love.graphics.rectangle("fill",36,82,w-72,2)
  line(107,"Servidor: motor Node original do al007ex/moomoo-clone (config local adicional)")
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
  line(341,"Pacotes autenticados recebidos do Node: "..tostring(serverPackets))
  if playerX and playerY then
    line(372,("Posicao AUTORITATIVA no servidor: X %d   Y %d"):format(playerX,playerY))
  end
  love.graphics.setColor(1,0.78,0.54)
  if client and client.sid then
    love.graphics.printf("Conexao, ticket e spawn confirmados. WASD envia direcao ao Node "..
      "e a posicao acima e devolvida pelo servidor. "..
      "Ainda FALTA o renderizador grafico fiel do jogo, o inventario e a interface.",
      36,410,w-72)
  else
    love.graphics.printf("O cliente solicita um ticket guest na API ORIGINAL "..
      "(/api/join), abre o WebSocket e tenta um spawn autenticado. "..
      "A partida ainda NAO foi confirmada: a janela aberta nao prova jogabilidade.",
      36,410,w-72)
  end
  love.graphics.setColor(0.67,0.77,0.71)
  love.graphics.printf("R: tentar novamente/renascer   |   WASD: movimento apos spawn   |   ESC: sair\n"..
    "Motor Node.js original; sem servidor Lua, proxy ou modificacoes nas regras de jogo.",
    36,h-115,w-72)
end

function love.keypressed(key)
  if key=="escape" then love.event.quit();return end
  if diagnostic then return end
  input:keypressed(key)
  -- Mirror the reference client's default gameplay bindings.
  if client and client.state=="spawn_confirmed" and not died then
    if key=="e" then client:send("K",{1});return end
    if key=="x" then client:send("K",{0});return end
    if key=="r" then client:send("S",{1});return end
    if key=="q" and world.inventory.items[1]~=nil then
      client:send("z",{world.inventory.items[1],false});return
    end
    local slot=tonumber(key)
    if slot and slot>=1 and slot<=9 then
      local weapons=world.inventory.weapons
      local items=world.inventory.items
      if weapons[slot]~=nil then
        client:send("z",{weapons[slot],true})
      else
        local item=items[slot-#weapons]
        if item~=nil then client:send("z",{item,false}) end
      end
      return
    end
    if key=="space" then
      local w,h=love.graphics.getDimensions()
      local mx,my=love.mouse.getPosition()
      client:send("F",{1,angle(my-h/2,mx-w/2)})
      return
    end
  end
  if key=="r" and client then
    if died and client.state=="spawn_confirmed" then
      local ok,reason=client:send("M",{
        Pack.map({name=client.name,moofoll=false,skin=0,anon=false})
      })
      if ok then latestEvent="Renascimento solicitado ao servidor Node original..."
      else latestEvent="Falha no renascimento: "..tostring(reason) end
      return
    end
    if client.state=="spawn_confirmed" then return end
    if client.state~="closed" and client.state~="failed" then return end
    reconnectSeconds=0
    startupError=nil
    playerX,playerY=nil,nil
    serverPackets=0
    lastMove=false
    lastAim=nil
    died=false
    heartbeatClock=0
    world=World.new()
    local ok,err=client:connect()
    if not ok then startupError=err end
  end
end
function love.keyreleased(key)
  if not diagnostic then input:keyreleased(key) end
  if key=="space" and client and client.state=="spawn_confirmed" then
    client:send("F",{0,Pack.null})
  end
end
function love.focus(focused)
  if not focused and client and client.state=="spawn_confirmed" then
    client:send("e",{})
    client:send("F",{0,Pack.null})
    input.keys={}
    lastMove=false
  end
end
function love.mousepressed(_,_,button)
  if diagnostic or not client or client.state~="spawn_confirmed" or died then return end
  if button==1 then
    local w,h=love.graphics.getDimensions()
    local mx,my=love.mouse.getPosition()
    client:send("F",{1,angle(my-h/2,mx-w/2)})
  end
end
function love.mousereleased(_,_,button)
  if diagnostic or not client or client.state~="spawn_confirmed" then return end
  if button==1 then client:send("F",{0,Pack.null}) end
end
function love.quit()
  if client then client:close() end
end

function love.resize(w,h)
  if camera then camera:resize(w,h) end
end
