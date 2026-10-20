-- First authoritative gameplay slice in Lua.
-- Gameplay values are from al007ex/moomoo-clone@06f7c1ca965a7628671676c8d9a7efd3997bb5e7
-- server/src/moomoo/modules/player.js and shared/config/items.js.
-- This is an incomplete port. Do not describe it as parity-complete.
local World=require("src.server.world")
local Player=require("src.server.player")
local Config=require("src.game.config")
local Catalog=require("src.game.catalog")
local Animals=require("src.server.animals")
local Game={}
Game.__index=Game
local pi=math.pi
local function finite(v)
  return type(v)=="number" and v==v and v~=math.huge and v~=-math.huge
end
local Pack=require("src.protocol.msgpack")
local function atan2(y,x)
  if math.atan2 then return math.atan2(y,x) end
  if x>0 then return math.atan(y/x) end
  if x<0 then return math.atan(y/x)+(y>=0 and math.pi or -math.pi) end
  if y>0 then return math.pi/2 end
  if y<0 then return -math.pi/2 end
  return 0
end
local function distance(x,y,a,b)
  local dx,dy=x-a,y-b
  return math.sqrt(dx*dx+dy*dy)
end
local function angleDiff(a,b)
  local delta=math.abs(b-a)%(pi*2)
  return delta>pi and (pi*2-delta) or delta
end
local function cleanName(name)
  if type(name)~="string" then return "unknown" end
  name=name:sub(1,15):gsub("[^%w :()%/?%-]"," "):match("^%s*(.-)%s*$")
  return name~="" and name or "unknown"
end
function Game.new(options)
  options=options or {}
  local world=options.world or World.new(options)
  if options.generate~=false then world:generate() end
  local animals=options.animals or Animals.new(world)
  return setmetatable({
    world=world,config=world.config or Config,players={},nextSid=0,
    animals=animals,elapsed=0
  },Game)
end
function Game:worldPacket()
  local objects={}
  for _,o in ipairs(self.world.objects) do
    if o.active then
      objects[#objects+1]={o.sid,o.x,o.y,o.scale,o.type,o.id or -1}
    end
  end
  local c=self.config
  return {"world",c.mapScale,c.riverWidth,c.snowBiomeTop,objects}
end
function Game:playerPacket()
  local out={}
  for _,p in pairs(self.players) do
    out[#out+1]={p.sid,p.name,p.x,p.y,p.dir,p.health,p.alive and 1 or 0}
  end
  return {"players",out}
end
function Game:animalPacket()
  return self.animals:packet()
end
function Game:statusPacket(p)
  return {"status",p.sid,p.wood,p.food,p.stone,p.points,p.XP,p.age,p.health}
end
function Game:join(id,name)
  assert(self.players[id]==nil,"duplicate session")
  local p=Player.new(self.world,{sid=self.nextSid,name=cleanName(name)})
  self.nextSid=self.nextSid+1
  p:spawn()
  local c=self.config
  local initial=(c.unlimitedResources and c.unlimitedAmount) or 0
  p.wood,p.food,p.stone,p.points=initial,initial,initial,initial
  p.XP,p.maxXP,p.age,p.upgradePoints=0,300,1,0
  p.weaponIndex=0
  p.items={0,3,6,10}
  p.itemCounts={}
  p.lastAttack=-1000
  self.players[id]=p
  return p,{self:worldPacket(),{"welcome",p.sid,p.name},self:statusPacket(p),self:playerPacket(),self:animalPacket()}
end
function Game:leave(id)
  self.players[id]=nil
end
function Game:attack(p)
  local weapon=Catalog.weaponById(p.weaponIndex)
  if not weapon or not p.alive or self.elapsed-p.lastAttack<(weapon.speed or 300) then return nil end
  p.lastAttack=self.elapsed
  local changed=false
  local hits=0
  for _,o in ipairs(self.world.objects) do
    if o.active and not o.isItem and o.type>=0 and o.type<=3 then
      local dist=distance(p.x,p.y,o.x,o.y)-o.scale
      if dist<=weapon.range and angleDiff(atan2(o.y-p.y,o.x-p.x),p.dir)<=self.config.gatherAngle then
        local resource=({"wood","food","stone","points"})[o.type+1]
        local count=(weapon.gather or 0)+(o.type==3 and 4 or 0)
        p[resource]=p[resource]+count
        p.XP=p.XP+4*(weapon.gather or 0)
        if p.XP>=p.maxXP then
          p.age=p.age+1
          p.XP=0
          p.maxXP=p.maxXP*1.2
          p.upgradePoints=p.upgradePoints+1
        end
        hits=hits+1
        changed=true
      end
    end
  end
  for _,animal in ipairs(self.animals.list) do
    if animal.alive and not animal.submerged and animal.spawnCounter==0 then
      local range=distance(p.x,p.y,animal.x,animal.y)-animal.scale*1.8
      if range<=weapon.range and angleDiff(atan2(animal.y-p.y,animal.x-p.x),p.dir)<=self.config.gatherAngle then
        self.animals:hit(animal,p,weapon)
        hits=hits+1
        changed=true
      end
    end
  end
  return changed and {"gather",hits} or {"gather",0}
end
function Game:buildWall(p,angle)
  -- 'wood wall' is item index 3 of shared/config/items.js.
  if not p.alive or not finite(angle) then return false,"invalid build command" end
  local c=self.config
  local item=Catalog.itemById(3)
  local group=Catalog.groupById(item.groupId)
  local wallScale=item.scale
  local offset=p.scale+wallScale+(item.placeOffset or 0)
  local x=p.x+offset*math.cos(angle)
  local y=p.y+offset*math.sin(angle)
  if x-wallScale<0 or x+wallScale>c.mapScale
    or y-wallScale<0 or y+wallScale>c.mapScale then
    return false,"outside world"
  end
  local groupId=item.groupId
  local count=p.itemCounts[groupId] or 0
  local limit=c.inSandbox and (group.sandboxLimit or math.max(group.limit*3,99)) or group.limit
  if count>=limit then return false,"structure limit" end
  if not c.inSandbox then
    for i=1,#item.req,2 do
      if (p[item.req[i]] or 0)<item.req[i+1] then
        return false,"insufficient "..item.req[i]
      end
    end
  end
  if not self.world:canPlace(x,y,wallScale,0.6,false) then
    return false,"blocked placement"
  end
  local o={
    sid=self.world.nextSid,x=x,y=y,scale=wallScale,dir=angle,
    active=true,type=item.type or 0,id=item.id,isItem=true,colDiv=item.colDiv or 1,
    health=item.health,layer=group.layer,owner=p.sid
  }
  self.world.nextSid=self.world.nextSid+1
  self.world.objects[#self.world.objects+1]=o
  p.itemCounts[groupId]=count+1
  if not c.inSandbox then
    for i=1,#item.req,2 do
      local resource=item.req[i]
      p[resource]=p[resource]-item.req[i+1]
    end
  end
  return true,o
end
function Game:command(id,packet)
  local p=self.players[id]
  if not p or type(packet)~="table" then return {} end
  local action=packet[1]
  if action=="move" then
    local direction=packet[2]
    if direction==Pack.null then direction=nil end
    p:setMoveDir(direction)
  elseif action=="aim" then
    p:setAim(packet[2])
  elseif action=="attack" then
    local hit=self:attack(p)
    if hit then return {hit,self:statusPacket(p)} end
  elseif action=="respawn" then
    if p.alive then return {} end
    p:spawn()
    local c=self.config
    local initial=(c.unlimitedResources and c.unlimitedAmount) or 0
    p.wood,p.food,p.stone,p.points=initial,initial,initial,initial
    p.XP,p.maxXP,p.age,p.upgradePoints=0,300,1,0
    p.weaponIndex=0
    p.items={0,3,6,10}
    p.itemCounts={}
    p.lastAttack=self.elapsed-1000
    return {{"respawned",p.sid},self:statusPacket(p),self:playerPacket()}
  elseif action=="build" then
    local ok,result=self:buildWall(p,packet[2])
    if ok then
      return {{"object",result.sid,result.x,result.y,result.scale,result.type,result.id},self:statusPacket(p)}
    end
    return {{"error",result}}
  end
  return {}
end
function Game:tick(delta)
  assert(finite(delta) and delta>0 and delta<=1000,"invalid tick delta")
  self.elapsed=self.elapsed+delta
  for _,p in pairs(self.players) do
    p:tick(delta)
  end
  self.animals:tick(delta,self.players)
  return self:playerPacket()
end
return Game
