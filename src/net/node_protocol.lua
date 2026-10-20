-- Converts ORIGINAL MooMoo server->client gameplay packets into the
-- current Lua renderer's state events. No duplicated world simulation here.
-- Input: ["event", packetName, originalArgs] from Node nativeBridge.js.
-- Original packet shapes: server/src/moomoo/server.js @ 06f7c1c.
local C=require("src.game.config")
local Animals=require("src.game.animals")
local P={}
P.__index=P
local function validNumber(v) return type(v)=="number" and v==v end
local function eventPlayers(self)
  local list={}
  for sid,p in pairs(self.players) do
    list[#list+1]={sid,p.name,p.x,p.y,p.dir,p.health,p.alive and 1 or 0}
  end
  return {"players",list}
end
local function eventAnimals(self)
  local list={}
  for sid,a in pairs(self.animals) do
    list[#list+1]={sid,a.index,a.x,a.y,a.dir,a.health,a.name,a.state}
  end
  return {"animals",list}
end
function P.new()
  return setmetatable({
    players={},animals={},objects={},
    sid=nil,wood=0,food=0,stone=0,points=0,XP=0,age=1,health=100
  },P)
end
function P:decode(wire)
  if type(wire)~="table" or wire[1]~="event" then return {} end
  local name,args=wire[2],wire[3]
  if type(name)~="string" or type(args)~="table" then return {} end
  local out={}
  if name=="A" then
    out[1]={"world",C.mapScale,C.riverWidth,C.snowBiomeTop,{}}
  elseif name=="C" then
    self.sid=args[1]
    if type(self.sid)=="number" then out[1]={"welcome",self.sid,"Jogador"} end
  elseif name=="D" then
    local raw=args[1]
    if type(raw)~="table" or type(raw[2])~="number" then return {} end
    local sid=raw[2]
    self.players[sid]={
      id=raw[1],name=raw[3] or "Jogador",x=raw[4] or 0,y=raw[5] or 0,
      dir=raw[6] or 0,health=raw[7] or 100,alive=true
    }
    out[1]=eventPlayers(self)
  elseif name=="a" then
    local positions=args[1] or {}
    if type(positions)~="table" then return {} end
    for i=1,#positions,4 do
      local sid=positions[i]
      local p=self.players[sid]
      if p and validNumber(positions[i+1]) and validNumber(positions[i+2]) then
        p.x,p.y,p.dir=positions[i+1],positions[i+2],(positions[i+3] or 0)/100
      end
    end
    for _,sid in ipairs(args[3] or {}) do
      self.players[sid]=nil
    end
    out[1]=eventPlayers(self)
  elseif name=="H" then
    local entries=args[1] or {}
    if type(entries)~="table" then return {} end
    for i=1,#entries,8 do
      local sid,x,y,dir,scale,kind,itemId=
        entries[i],entries[i+1],entries[i+2],entries[i+3],
        entries[i+4],entries[i+5],entries[i+6]
      if validNumber(sid) and validNumber(x) and validNumber(y)
         and validNumber(scale) and validNumber(kind) then
        if not self.objects[sid] then
          self.objects[sid]=true
          local id=(type(itemId)=="number") and itemId or -1
          out[#out+1]={"object",sid,x,y,scale,kind,id}
        end
      end
    end
  elseif name=="I" then
    local entries=args[1] or {}
    if type(entries)~="table" then return {} end
    for i=1,#entries,8 do
      local sid,kind,x,y,dir,health,nameIndex,state=
        entries[i],entries[i+1],entries[i+2],entries[i+3],
        entries[i+4],entries[i+5],entries[i+6],entries[i+7]
      if validNumber(sid) and validNumber(kind) then
        local def=Animals.byId(kind)
        self.animals[sid]={
          index=kind,x=x or 0,y=y or 0,dir=(dir or 0)/100,
          health=health or 0,name=(def and def.name) or (def and def.src) or "Animal",
          state=state or 0
        }
      end
    end
    for _,sid in ipairs(args[2] or {}) do self.animals[sid]=nil end
    out[1]=eventAnimals(self)
  elseif name=="N" then
    local key,value=args[1],args[2]
    if (key=="wood" or key=="food" or key=="stone" or key=="points")
      and type(value)=="number" then self[key]=value end
    if type(self.sid)=="number" then
      out[1]={"status",self.sid,self.wood,self.food,self.stone,self.points,self.XP,self.age,self.health}
    end
  elseif name=="O" then
    local sid,health=args[1],args[2]
    if self.players[sid] and type(health)=="number" then
      self.players[sid].health=health
      if sid==self.sid then self.health=health end
      out[1]=eventPlayers(self)
    end
  elseif name=="P" then
    local localPlayer=self.players[self.sid]
    if localPlayer then localPlayer.alive=false;localPlayer.health=0 end
    out[1]=eventPlayers(self)
    out[2]={"dead"}
  elseif name=="E" then
    local id=args[1]
    for sid,p in pairs(self.players) do
      if p.id==id then self.players[sid]=nil end
    end
    out[1]=eventPlayers(self)
  elseif name=="J" then
    -- Object removal; some H removal events use different packet names.
    local sid=args[1]
    if type(sid)=="number" then
      self.objects[sid]=nil
      out[1]={"remove_object",sid}
    end
  elseif name=="T" then
    if type(args[1])=="number" then self.XP=args[1] end
    if type(args[3])=="number" then self.age=args[3] end
    if self.sid then
      out[1]={"status",self.sid,self.wood,self.food,self.stone,self.points,self.XP,self.age,self.health}
    end
  elseif name=="B" then
    out[1]={"error",tostring(args[1] or "Servidor encerrou a sessao")}
  elseif name=="6" then
    out[1]={"chat",args[1],tostring(args[2] or "")}
  end
  return out
end
return P
