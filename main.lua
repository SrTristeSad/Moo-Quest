local Camera=require("src.camera")
local Input=require("src.input")
local Client=require("src.net.local_client")
local AnimalTypes=require("src.game.animals")
local camera,input,client,serverThread
local testResults=nil
local serverStatus="Iniciando servidor Lua..."
local world=nil
local players={}
local animals={}
local localSid=nil
local resources={wood=0,food=0,stone=0,points=0,age=1,XP=0,health=100}
local selected=0 -- 0 = hammer, 3 = reference wood wall (item index 3).
local lastMove,lastAim=nil,nil
local transmitClock=0
local attackClock=0
local notification=""
local port=17017
local G={}

local function atan2(y,x)
  if math.atan2 then return math.atan2(y,x) end
  if x>0 then return math.atan(y/x) end
  if x<0 then return math.atan(y/x)+(y>=0 and math.pi or -math.pi) end
  if y>0 then return math.pi/2 end
  if y<0 then return -math.pi/2 end
  return 0
end
local function selfPlayer()
  return localSid and players[localSid] or nil
end
local function aimAngle()
  local p=selfPlayer()
  if not p then return 0 end
  local mx,my=love.mouse.getPosition()
  local x,y=camera:screenToWorld(mx,my)
  return atan2(y-p.y,x-p.x)
end
local function drawTree(x,y,size)
  local r=size*0.48
  love.graphics.setColor(0.32,0.21,0.12)
  love.graphics.circle("fill",x+2,y+size*0.14,size*0.19)
  love.graphics.setColor(0.14,0.34,0.20)
  love.graphics.circle("fill",x-r*0.45,y-r*0.18,r*0.78)
  love.graphics.circle("fill",x+r*0.49,y-r*0.12,r*0.78)
  love.graphics.setColor(0.22,0.47,0.28)
  love.graphics.circle("fill",x,y-r*0.54,r)
  love.graphics.setColor(0.32,0.58,0.36,0.45)
  love.graphics.circle("fill",x-r*0.19,y-r*0.62,r*0.35)
end
local function drawBush(x,y,size)
  love.graphics.setColor(0.18,0.41,0.19)
  love.graphics.circle("fill",x,y,size*0.53)
  love.graphics.setColor(0.29,0.55,0.28)
  love.graphics.circle("fill",x-size*0.16,y-size*0.18,size*0.32)
  love.graphics.setColor(0.77,0.23,0.23)
  love.graphics.circle("fill",x+size*0.12,y-size*0.13,math.max(3,size*0.055))
end
local function drawRock(x,y,size,ore)
  local r=size*0.62
  love.graphics.setColor(ore and 0.44 or 0.36,ore and 0.36 or 0.41,ore and 0.21 or 0.42)
  love.graphics.polygon("fill",x-r,y+r*0.54,x-r*0.65,y-r*0.65,x+r*0.2,y-r,x+r,y-r*0.1,x+r*0.7,y+r*0.7)
  love.graphics.setColor(ore and 0.91 or 0.57,ore and 0.71 or 0.61,ore and 0.27 or 0.61)
  love.graphics.polygon("fill",x-r*0.62,y-r*0.45,x+r*0.2,y-r*0.83,x+r*0.55,y-r*0.09,x-r*0.1,y)
end
local function drawWall(x,y,size)
  local width=size*2
  love.graphics.setColor(0.20,0.16,0.11)
  love.graphics.rectangle("fill",x-size,y-size,width,width)
  for i=0,3 do
    love.graphics.setColor(i%2==0 and 0.55 or 0.44,0.33,0.17)
    love.graphics.rectangle("fill",x-size+5+i*(width-10)/4,y-size+4,(width-10)/4-3,width-8)
  end
  love.graphics.setColor(0.25,0.20,0.13)
  love.graphics.rectangle("line",x-size,y-size,width,width)
end
local function drawGround(w,h)
  love.graphics.clear(0.36,0.57,0.32)
  if not world then return end
  local left,top=camera:screenToWorld(0,0)
  local right,bottom=camera:screenToWorld(w,h)
  local snowBottom=world.snowBiomeTop
  if top<snowBottom then
    local y=select(2,camera:worldToScreen(0,snowBottom))
    love.graphics.setColor(0.76,0.83,0.79)
    love.graphics.rectangle("fill",0,0,w,math.min(h,y))
  end
  local desertTop=world.mapScale-world.snowBiomeTop
  if bottom>desertTop then
    local y=select(2,camera:worldToScreen(0,desertTop))
    love.graphics.setColor(0.72,0.64,0.43)
    love.graphics.rectangle("fill",0,math.max(0,y),w,h)
  end
  local riverTop=world.mapScale/2-world.riverWidth/2
  local riverBottom=world.mapScale/2+world.riverWidth/2
  if bottom>=riverTop and top<=riverBottom then
    local sy=select(2,camera:worldToScreen(0,riverTop))
    local ey=select(2,camera:worldToScreen(0,riverBottom))
    love.graphics.setColor(0.24,0.49,0.62)
    love.graphics.rectangle("fill",0,sy,w,ey-sy)
    love.graphics.setColor(0.52,0.70,0.76,0.45)
    love.graphics.rectangle("fill",0,sy,w,6)
    love.graphics.rectangle("fill",0,ey-6,w,6)
  end
  -- World boundaries make orientation clear without fabricating interactable objects.
  local x0,y0=camera:worldToScreen(0,0)
  local x1,y1=camera:worldToScreen(world.mapScale,world.mapScale)
  love.graphics.setColor(0.14,0.26,0.17)
  love.graphics.rectangle("line",x0,y0,x1-x0,y1-y0)
end
local function drawObjects(w,h)
  if not world then return end
  -- Sort once at receipt; existing objects are intentionally preserved server-side.
  for _,o in ipairs(world.objects) do
    local x,y=camera:worldToScreen(o.x,o.y)
    if x>-250 and x<w+250 and y>-250 and y<h+250 then
      local size=o.scale*camera.zoom
      if o.id==3 then drawWall(x,y,size)
      elseif o.kind==0 then drawTree(x,y,size)
      elseif o.kind==1 then drawBush(x,y,size)
      elseif o.kind==2 then drawRock(x,y,size,false)
      elseif o.kind==3 then drawRock(x,y,size,true)
      end
    end
  end
end
local function drawAnimals(w,h)
  for _,animal in pairs(animals) do
    local x,y=camera:worldToScreen(animal.x,animal.y)
    if x>-170 and x<w+170 and y>-170 and y<h+170 then
      local r=(animal.index==11 and 90 or (animal.index==6 and 55 or 32))*camera.zoom
      local hostile=(animal.index==2 or animal.index==3 or animal.index==4
        or animal.index==6 or animal.index==8 or animal.index==9
        or animal.index==10 or animal.index==11)
      if animal.index==11 then love.graphics.setColor(0.40,0.28,0.57)
      elseif hostile then love.graphics.setColor(0.56,0.28,0.23)
      else love.graphics.setColor(0.68,0.52,0.37) end
      love.graphics.circle("fill",x,y,r)
      love.graphics.setColor(0.22,0.16,0.13)
      love.graphics.circle("line",x,y,r)
      local dx,dy=math.cos(animal.dir),math.sin(animal.dir)
      love.graphics.setColor(0.91,0.83,0.68)
      love.graphics.circle("fill",x+dx*r*0.55,y+dy*r*0.55,math.max(2,r*0.17))
      love.graphics.setColor(1,1,1)
      love.graphics.printf(animal.name,x-80,y-r-26,160,"center")
      love.graphics.setColor(0.25,0.16,0.14)
      love.graphics.rectangle("fill",x-r*0.7,y+r+6,r*1.4,5)
      -- Full health values are sent by the authoritative Lua server.
      local def=AnimalTypes.byId(animal.index)
      local max=def and def.health or 1
      love.graphics.setColor(0.25,0.76,0.33)
      love.graphics.rectangle("fill",x-r*0.7,y+r+6,r*1.4*math.max(0,math.min(1,animal.health/max)),5)
    end
  end
end
local function drawPlayers(w,h)
  for sid,p in pairs(players) do
    if p.alive then
      local x,y=camera:worldToScreen(p.x,p.y)
      if x>-50 and x<w+50 and y>-50 and y<h+50 then
        local r=35*camera.zoom
        love.graphics.setColor(0,0,0,0.2)
        love.graphics.ellipse("fill",x,y+r*0.6,r*0.75,r*0.31)
        if sid==localSid then love.graphics.setColor(0.83,0.70,0.48)
        else love.graphics.setColor(0.74,0.61,0.52) end
        love.graphics.circle("fill",x,y,r)
        love.graphics.setColor(0.28,0.21,0.13)
        local dx,dy=math.cos(p.dir),math.sin(p.dir)
        love.graphics.setLineWidth(5)
        love.graphics.line(x+dx*r*0.4,y+dy*r*0.4,x+dx*r*1.52,y+dy*r*1.52)
        love.graphics.setColor(0.12,0.12,0.1)
        love.graphics.circle("line",x,y,r)
        love.graphics.setColor(1,1,1)
        love.graphics.printf(p.name,x-90,y-r-24,180,"center")
      end
    end
  end
  love.graphics.setLineWidth(1)
end
local function onServerMessage(msg)
  local kind=msg[1]
  if kind=="world" then
    world={mapScale=msg[2],riverWidth=msg[3],snowBiomeTop=msg[4],objects={}}
    for _,o in ipairs(msg[5] or {}) do
      world.objects[#world.objects+1]={
        sid=o[1],x=o[2],y=o[3],scale=o[4],kind=o[5],id=o[6]
      }
    end
    serverStatus="Mundo recebido do servidor Lua"
  elseif kind=="welcome" then
    localSid=msg[2]
    serverStatus="Conectado ao servidor Lua (ID "..tostring(localSid)..")"
  elseif kind=="players" then
    local nextPlayers={}
    for _,raw in ipairs(msg[2] or {}) do
      nextPlayers[raw[1]]={
        name=raw[2],x=raw[3],y=raw[4],dir=raw[5],
        health=raw[6],alive=raw[7]==1
      }
    end
    players=nextPlayers
    if localSid and players[localSid] then resources.health=players[localSid].health end
  elseif kind=="animals" then
    local nextAnimals={}
    for _,raw in ipairs(msg[2] or {}) do
      nextAnimals[raw[1]]={sid=raw[1],index=raw[2],x=raw[3],y=raw[4],
        dir=raw[5],health=raw[6],name=raw[7],state=raw[8]}
    end
    animals=nextAnimals
  elseif kind=="respawned" then
    notification="Renascimento confirmado pelo servidor"
  elseif kind=="status" then
    if msg[2]==localSid then
      resources={wood=msg[3],food=msg[4],stone=msg[5],points=msg[6],
        XP=msg[7],age=msg[8],health=msg[9]}
    end
  elseif kind=="object" then
    if world then
      world.objects[#world.objects+1]={
        sid=msg[2],x=msg[3],y=msg[4],scale=msg[5],kind=msg[6],id=msg[7]
      }
    end
  elseif kind=="gather" then
    notification=msg[2]>0 and ("Coleta confirmada: "..msg[2]) or "Nada ao alcance"
  elseif kind=="error" then notification="Servidor: "..tostring(msg[2])
  end
end

function love.load()
  love.graphics.setDefaultFilter("nearest","nearest")
  if os.getenv("MOOQUEST_TESTS")=="1" then
    testResults=require("src.test_runner").run()
    return
  end
  camera=Camera.new()
  camera.zoom=1
  input=Input.new()
  -- Each game instance starts its own separate, authoritative Lua server thread.
  -- No JS runtime, browser or externally hosted server is required.
  love.thread.getChannel("moo_server_status"):clear()
  love.thread.getChannel("moo_server_control"):clear()
  serverThread=love.thread.newThread("src/server/worker.lua")
  serverThread:start(port)
end
function love.resize(w,h)
  if camera then camera:resize(w,h) end
end
function love.update(dt)
  if testResults then return end
  input:update(dt)
  if serverThread then
    local fatal=serverThread:getError()
    if fatal then serverStatus="Erro no servidor Lua: "..tostring(fatal) end
  end
  local channel=love.thread.getChannel("moo_server_status")
  while true do
    local event=channel:pop()
    if not event then break end
    if event[1]=="ready" and not client then
      local ok,res=pcall(Client.new,{})
      if ok then
        client=res
        local connected,why=client:connect(event[2])
        if not connected then serverStatus="Falha TCP: "..tostring(why) end
      else
        serverStatus="LuaSocket indisponivel: "..tostring(res)
      end
    elseif event[1]=="error" then
      serverStatus="Servidor: "..tostring(event[2])
    end
  end
  if client then
    client:update()
    if client.state=="failed" then serverStatus="Falha de rede: "..tostring(client.error) end
    if client.state=="closed" then serverStatus="Servidor desconectado" end
    if client.state=="open" and not G.joinSent then
      client:queue({"join","Jogador"})
      G.joinSent=true
      serverStatus="Aguardando spawn..."
    end
    for _,msg in ipairs(client:drain()) do onServerMessage(msg) end
  end
  local p=selfPlayer()
  if p then
    camera:follow(p.x,p.y)
    transmitClock=transmitClock+dt
    attackClock=attackClock+dt
    if client and client.state=="open" and transmitClock>=0.05 then
      transmitClock=0
      local dx,dy=input.dx,input.dy
      local move=(dx~=0 or dy~=0) and atan2(dy,dx) or false
      local aim=aimAngle()
      if move~=lastMove then
        client:queue({"move",move==false and require("src.protocol.msgpack").null or move})
        lastMove=move
      end
      if not lastAim or math.abs(aim-lastAim)>0.01 then
        client:queue({"aim",aim})
        lastAim=aim
      end
    end
    if selected==0 and input.buttons[1] and attackClock>=0.31
      and client and client.state=="open" then
      client:queue({"attack"})
      attackClock=0
    end
  end
end
function love.draw()
  if testResults then
    love.graphics.clear(0.075,0.10,0.12)
    love.graphics.setColor(1,1,1)
    love.graphics.print("MOO-QUEST | DIAGNOSTICO LUA / LOVE 2D",28,24,0,1.5)
    love.graphics.print(string.format("Aprovados: %d   Falhas: %d",testResults.passed,testResults.failed),28,66)
    for i,row in ipairs(testResults.rows) do
      love.graphics.setColor(row.pass and 0.40 or 1,row.pass and 0.90 or 0.45,row.pass and 0.54 or 0.38)
      love.graphics.print((row.pass and "OK   " or "FALHA ")..row.path,28,98+(i-1)*27)
      if not row.pass then
        love.graphics.setColor(0.96,0.78,0.63)
        local short=row.error:gsub("[\\r\\n]+"," "):sub(1,110)
        love.graphics.print(short,405,98+(i-1)*27)
      end
    end
    love.graphics.setColor(1,1,1)
    love.graphics.print("Relatorio: "..tostring(testResults.reportPath or testResults.reportError or "nao disponivel"),28,543)
    love.graphics.print("Copie o relatorio para investigar falhas. ESC encerra.",28,571)
    return
  end
  local w,h=love.graphics.getDimensions()
  drawGround(w,h)
  drawObjects(w,h)
  drawAnimals(w,h)
  drawPlayers(w,h)
  love.graphics.setColor(0.10,0.15,0.12,0.87)
  love.graphics.rectangle("fill",12,12,470,71,8,8)
  love.graphics.setColor(1,1,1)
  love.graphics.print("MOO-QUEST | Lua local (desenvolvimento)",24,20)
  love.graphics.setColor(0.79,0.91,0.81)
  love.graphics.print(serverStatus,24,45)
  if localSid then
    love.graphics.setColor(0.07,0.14,0.09,0.82)
    love.graphics.rectangle("fill",12,h-80,620,68,8,8)
    love.graphics.setColor(1,1,1)
    love.graphics.print(string.format("Madeira %d  Comida %d  Pedra %d  Ouro %d",
      resources.wood,resources.food,resources.stone,resources.points),24,h-70)
    love.graphics.print("WASD mover | Mouse atacar | 1 parede | 2 martelo | R renascer | ESC sair",24,h-47)
    love.graphics.print("Equipado: "..(selected==3 and "Parede de madeira" or "Martelo"),24,h-28)
  end
  if notification~="" then
    love.graphics.setColor(1,0.96,0.70)
    love.graphics.printf(notification,0,h-118,w,"center")
  end
  if not world then
    love.graphics.setColor(1,1,1)
    love.graphics.printf("Aguardando o mundo real do servidor Lua...",0,h/2,w,"center")
  end
  love.graphics.setColor(0.91,0.94,0.90)
  love.graphics.print("Marco inicial, paridade incompleta. Artes vetoriais temporarias.",w-460,12)
end
function love.keypressed(key)
  if testResults then
    if key=="escape" then love.event.quit() end
    return
  end
  if key=="escape" then love.event.quit()
  elseif key=="1" then selected=3
  elseif key=="2" then selected=0
  elseif key=="r" and client and client.state=="open" then
    local p=selfPlayer()
    if p and not p.alive then client:queue({"respawn"}) end
  end
  input:keypressed(key)
end
function love.keyreleased(key) if input then input:keyreleased(key) end end
function love.mousepressed(x,y,button)
  if not input then return end
  input:mousepressed(x,y,button)
  if button==1 and selected==3 and client and client.state=="open" and selfPlayer() then
    client:queue({"build",aimAngle()})
  end
end
function love.mousereleased(x,y,button) if input then input:mousereleased(x,y,button) end end
function love.quit()
  if testResults then return end
  if client then client:close() end
  love.thread.getChannel("moo_server_control"):push("stop")
end
