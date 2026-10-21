-- Moo-Quest is a Lua client for the UNMODIFIED al007ex/moomoo-clone server.
-- Real native gameplay rendering is gated by actual server C/D/a/H/I packets.
-- Never generate local entities or claim spawn before the Node server confirms it.
local Original=require("src.net.original_client")
local World=require("src.game.world_state")
local View=require("src.game.reference_view")
local Menu=require("src.game.reference_menu")
local Config=require("src.game.config")
local Hud=require("src.game.reference_hud")
local Upgrades=require("src.game.reference_upgrades")
local Assets=require("src.game.reference_assets")
local Camera=require("src.camera")
local Input=require("src.input")
local Pack=require("src.protocol.msgpack")
local client=nil
local world=World.new()
local camera=nil
local menuCamera=nil
local menu=Menu.new()
local phase="menu"
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
local chatOpen=false
local chatDraft=""
local mouseAttack=false
local spaceAttack=false
local lockDir=false
local angle
local function currentAttackDir()
  local w,h=love.graphics.getDimensions()
  local mx,my=love.mouse.getPosition()
  return angle(my-h/2,mx-w/2)
end
local function shortenChat(text)
  -- JavaScript chatBox.value.slice(0,30): keep up to 30 UTF-8 characters.
  local count=0
  for i=1,#text do
    local b=text:byte(i)
    if b<128 or b>=192 then
      count=count+1
      if count>30 then return text:sub(1,i-1) end
    end
  end
  return text
end
local function backspaceUtf8(text)
  local pos=#text
  while pos>1 do
    local b=text:byte(pos)
    if b<128 or b>=192 then break end
    pos=pos-1
  end
  return text:sub(1,pos-1)
end

function love.load()
  love.graphics.setDefaultFilter("linear","linear")
  camera=Camera.new()
  menuCamera=Camera.new()
  menuCamera:follow(Config.mapScale/2,Config.mapScale/2)
  if os.getenv("MOOQUEST_TESTS")=="1" then
    diagnostic=require("src.test_runner").run()
    -- Automated Windows batch tests must fail with an OS error code, not
    -- only print failing assertions inside an otherwise successful LÖVE run.
    if os.getenv("MOOQUEST_TESTS_EXIT")=="1" then
      love.event.quit(diagnostic.failed>0 and 1 or 0)
    end
    return
  end
  local ok,result=pcall(Original.new,{host="127.0.0.1",port=8080,server="LC",autoSpawn=false})
  if not ok then
    startupError="Falha ao inicializar cliente de rede: "..tostring(result)
    return
  end
  client=result
  local connected,err=client:connect()
  if not connected then startupError=err end
end

angle=function(y,x)
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
        phase="playing"
        latestEvent="SPAWN CONFIRMADO pelo Node original. SID "..tostring(client.sid)
        movementClock=0
        lastMove=false
        lastAim=nil
        -- The reference client's addPlayer(isYou) snaps the camera on spawn.
        -- Reset smoothing when respawning or entering a new match.
        if camera then camera.hasTarget=false end
        lockDir=false
        mouseAttack=false
        spaceAttack=false
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
        chatOpen=false;chatDraft=""
        died=true
        phase="menu"
        menu.status="Voce morreu. Pressione Play para renascer."
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
      local aim=lockDir and (lastAim or 0) or currentAttackDir()
      if not lastAim or math.abs(aim-lastAim)>0.02 then
        client:send("D",{aim})
        lastAim=aim
      end
    end
  end
  if client.state=="failed" or client.state=="closed" then
    phase="menu"
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
  if phase=="menu" then
    View.draw(menu.world,menuCamera,frameDelta)
    menu:draw(client and client.state,
      (client and (client.error or client.status)) or startupError or menu.status)
    return
  end
  if client and client.state=="spawn_confirmed" and not died
    and p and p.x and p.y then
    View.draw(world,camera,frameDelta)
    Hud.draw(world,chatOpen,chatDraft)
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
    love.graphics.printf("Conexao e spawn confirmados pelo Node. "..
      "Aguardando os primeiros pacotes de posicao e entidades para desenhar a partida. "..
      "O porte visual continua em validacao com o cliente original.",
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

local function requestPlay()
  if not client then
    menu.status=startupError or "Cliente de rede indisponivel."
    return false
  end
  if client.state~="keyed_transport" and
    not (died and client.state=="spawn_confirmed") then
    menu.status="Aguardando conexao com Node. Estado: "..tostring(client.state)
    return false
  end
  local ok,why=client:spawn({name=menu.name,skin=menu.skin})
  if not ok then
    menu.status="Falha ao entrar: "..tostring(why)
    return false
  end
  died=false
  menu.status="Entrando na partida; aguardando confirmacao do Node..."
  return true
end
function love.keypressed(key)
  if key=="escape" then
    if chatOpen then chatOpen=false;chatDraft="";return end
    love.event.quit();return
  end
  if diagnostic then return end
  if phase=="menu" then
    if key=="r" and client and
      (client.state=="failed" or client.state=="closed") then
      world=World.new()
      local ok,why=client:connect()
      if not ok then menu.status=tostring(why) end
      return
    end
    local action=menu:keypressed(key)
    if action=="play" then requestPlay() end
    return
  end
  if chatOpen then
    if key=="return" or key=="kpenter" then
      local value=shortenChat(chatDraft)
      if #value>0 and client then client:send("6",{value}) end
      chatDraft="";chatOpen=false
    elseif key=="backspace" then
      chatDraft=backspaceUtf8(chatDraft)
    end
    return
  end
  if (key=="return" or key=="kpenter") and client
    and client.state=="spawn_confirmed" and not died then
    chatOpen=true;chatDraft=""
    input.keys={}
    lastMove=false
    client:send("e",{})
    return
  end
  input:keypressed(key)
  -- Mirror the reference client's default gameplay bindings.
  if client and client.state=="spawn_confirmed" and not died then
    if key=="e" then client:send("K",{1});return end
    if key=="x" then
      local ok=client:send("K",{0})
      if ok then lockDir=not lockDir end
      return
    end
    if key=="r" then client:send("S",{1});return end
    if key=="c" then
      local p=world:localPlayer()
      if p and p.x and p.y then world.mapMarker={x=p.x,y=p.y} end
      return
    end
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
    if key=="space" and not spaceAttack then
      spaceAttack=true
      if not mouseAttack then client:send("F",{1,currentAttackDir()}) end
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
    lockDir=false
    mouseAttack=false
    spaceAttack=false
    died=false
    heartbeatClock=0
    world=World.new()
    if camera then camera.hasTarget=false end
    local ok,err=client:connect()
    if not ok then startupError=err end
  end
end
function love.textinput(text)
  if phase=="menu" then menu:textinput(text);return end
  if chatOpen and type(text)=="string" then
    chatDraft=shortenChat(chatDraft..text)
  end
end
function love.keyreleased(key)
  if not diagnostic then input:keyreleased(key) end
  if key=="space" and spaceAttack then
    spaceAttack=false
    if not mouseAttack and client and client.state=="spawn_confirmed" then
      client:send("F",{0,Pack.null})
    end
  end
end
function love.focus(focused)
  if not focused and client and client.state=="spawn_confirmed" then
    client:send("e",{})
    client:send("F",{0,Pack.null})
    mouseAttack=false;spaceAttack=false
    input.keys={}
    lastMove=false
  end
end
function love.mousepressed(x,y,button)
  if diagnostic then return end
  if phase=="menu" then
    if button==1 then
      local width,height=love.graphics.getDimensions()
      local action=menu:click(x,y,width,height)
      if action=="play" then requestPlay() end
    end
    return
  end
  if not client or client.state~="spawn_confirmed" or died then return end
  if chatOpen then return end
  if button==1 then
    local w,h=love.graphics.getDimensions()
    if Hud.mapHitTest(w,h,x,y) then
      client:send("S",{1})
      return
    end
    local upgradeIndex=Upgrades.hitTest(world,w,x,y)
    if upgradeIndex~=nil then
      client:send("H",{upgradeIndex})
      return
    end
    local itemIndex,isWeapon=Hud.hitTest(world,w,h,x,y)
    if itemIndex~=nil then
      client:send("z",{itemIndex,isWeapon})
      return
    end
    if not mouseAttack then
      mouseAttack=true
      if not spaceAttack then client:send("F",{1,currentAttackDir()}) end
    end
  end
end
function love.mousereleased(_,_,button)
  if diagnostic or not client or client.state~="spawn_confirmed" then return end
  if button==1 and mouseAttack then
    mouseAttack=false
    if not spaceAttack then client:send("F",{0,Pack.null}) end
  end
end
function love.quit()
  if client then client:close() end
end

function love.resize(w,h)
  if camera then camera:resize(w,h) end
  if menuCamera then menuCamera:resize(w,h) end
end
