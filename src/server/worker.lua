-- LÖVE worker thread: runs a standalone authoritative Lua game simulation,
-- bound exclusively to 127.0.0.1. No HTTP/FRVR/bundled browser client.
-- LuaSocket is shipped by supported LÖVE desktop distributions.
local socket=require("socket")
local Game=require("src.server.game")
local Frames=require("src.net.local_frames")
local status=love.thread.getChannel("moo_server_status")
local control=love.thread.getChannel("moo_server_control")
local port=tonumber(...) or 17017
local listener,bindError=socket.bind("127.0.0.1",port)
if not listener then
  status:push({"error",tostring(bindError)})
  return
end
listener:settimeout(0)
local game=Game.new()
local clients={}
local nextSession=0
local tickSeconds=1/game.config.serverUpdateRate
local lastTick=socket.gettime()
local accumulator=0

local function disconnect(client)
  pcall(function() client.socket:close() end)
  game:leave(client.id)
  clients[client.id]=nil
end

local function queue(client,message)
  if not clients[client.id] then return end
  local data=Frames.encode(message)
  if #client.output+#data>2097152 then
    disconnect(client)
  else
    client.output=client.output..data
  end
end

local function broadcast(message)
  for _,c in pairs(clients) do if c.joined then queue(c,message) end end
end

local function handle(client,message)
  if type(message)~="table" or type(message[1])~="string" then return end
  if not client.joined then
    if message[1]~="join" then return end
    local count=0
    for _,c in pairs(clients) do if c.joined then count=count+1 end end
    if count>=game.config.maxPlayers then queue(client,{"error","server full"});return end
    local player,initial=game:join(client.id,message[2])
    client.joined=true
    for _,event in ipairs(initial) do queue(client,event) end
    return
  end
  local results=game:command(client.id,message)
  for _,event in ipairs(results) do
    if event[1]=="object" then
      broadcast(event)
    else
      queue(client,event)
    end
  end
end

status:push({"ready",port})
while control:pop()~="stop" do
  -- Accept all currently waiting loopback connections.
  for _=1,8 do
    local tcp=listener:accept()
    if not tcp then break end
    tcp:settimeout(0)
    nextSession=nextSession+1
    local id="socket-"..tostring(nextSession)
    clients[id]={id=id,socket=tcp,input="",output="",joined=false,
      rateStart=socket.gettime(),rateCount=0}
  end
  local pendingDisconnect={}
  for id,client in pairs(clients) do
    local s=client.socket
    -- Reading is bounded per loop, including incomplete frames.
    for _=1,4 do
      local data,err,partial=s:receive(8192)
      local chunk=data or partial or ""
      if #chunk>0 then client.input=client.input..chunk end
      if #client.input>Frames.maxBytes+4 then
        pendingDisconnect[#pendingDisconnect+1]=client
        break
      end
      if #chunk>0 then
        local packets,rest=Frames.decode(client.input)
        if not packets then
          pendingDisconnect[#pendingDisconnect+1]=client
          break
        end
        client.input=rest
        local now=socket.gettime()
        if now-client.rateStart>=1 then client.rateStart=now;client.rateCount=0 end
        for _,packet in ipairs(packets) do
          client.rateCount=client.rateCount+1
          if client.rateCount>80 then
            pendingDisconnect[#pendingDisconnect+1]=client
            break
          end
          local ok,why=pcall(handle,client,packet)
          if not ok then
            status:push({"error","session "..id..": "..tostring(why)})
            pendingDisconnect[#pendingDisconnect+1]=client
            break
          end
        end
      end
      if err=="closed" or (err and err~="timeout") then
        pendingDisconnect[#pendingDisconnect+1]=client
        break
      end
      if #chunk==0 then break end
    end
    if clients[id] and #client.output>0 then
      local sent,err,last=s:send(client.output)
      local n=sent or last or 0
      if n>0 then client.output=client.output:sub(n+1) end
      if err and err~="timeout" then
        pendingDisconnect[#pendingDisconnect+1]=client
      end
    end
  end
  for _,c in ipairs(pendingDisconnect) do
    if clients[c.id] then disconnect(c) end
  end
  local now=socket.gettime()
  local elapsed=math.min(now-lastTick,0.25)
  lastTick=now
  accumulator=accumulator+elapsed
  local steps=0
  while accumulator>=tickSeconds and steps<4 do
    local packet=game:tick(tickSeconds*1000)
    broadcast(packet)
    accumulator=accumulator-tickSeconds
    steps=steps+1
  end
  if steps>=4 then accumulator=0 end
  socket.sleep(0.004)
end
for _,client in pairs(clients) do pcall(function() client.socket:close() end) end
listener:close()
status:push({"stopped"})
