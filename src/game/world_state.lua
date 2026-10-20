-- Protocol-driven game state. All entities originate in packets from the Node server.
-- Packet layouts: al007ex/moomoo-clone/server/src/moomoo/server.js (pinned baseline).
local Catalog=require("src.game.catalog")
local Animation=require("src.game.reference_animation")
local World={}
World.__index=World
local function number(v) return type(v)=="number" and v==v and v~=math.huge and v~=-math.huge end
local function validId(v) return number(v) and v%1==0 and v>=0 end
local function array(v) return type(v)=="table" and v or {} end
-- Snapshot smoothing follows the 170ms transition used in the JS updateGame().
local function receivePosition(entity,x,y,dir)
  entity.fromX=entity.visualX or entity.x or x
  entity.fromY=entity.visualY or entity.y or y
  entity.toX=x;entity.toY=y
  entity.visualX=entity.fromX;entity.visualY=entity.fromY
  entity.interp=0
  entity.x=x;entity.y=y
  if number(dir) then entity.dir=dir end
end

function World.new()
  return setmetatable({
    sid=nil,spawned=false,dead=false,players={},objects={},animals={},projectiles={},
    resources={},inventory={weapons={},items={}},leaderboard={},
    xp=0,maxXP=0,age=1,upgradePoints=0,upgradeAge=0,
    packets=0,lastPacket=nil
  },World)
end

function World:apply(name,args)
  if type(name)~="string" then return false end
  args=array(args)
  self.packets=self.packets+1
  self.lastPacket=name
  if name=="C" then
    if not validId(args[1]) then return false end
    self.sid=args[1];self.spawned=true;self.dead=false
    -- server/src/moomoo/modules/player.js::spawn initializes this in Node;
    -- the JavaScript client's Player.spawn() mirrors it locally.
    -- The server does not send V on each new spawn, only when inventory changes.
    self.inventory={weapons={0},items={0,3,6,10}}
    self.xp=0;self.maxXP=300;self.age=1
    self.upgradePoints=0;self.upgradeAge=2
    self.resources={}
    return true
  elseif name=="D" then
    -- [id,sid,name,x,y,dir,health,maxHealth,scale,skinColor,...]
    local d=array(args[1])
    local id=d[2]
    if not validId(id) or not number(d[4]) or not number(d[5]) then return false end
    local p=self.players[id] or {sid=id}
    p.id=d[1];p.name=type(d[3])=="string" and d[3] or "unknown"
    receivePosition(p,d[4],d[5],number(d[6]) and d[6] or 0)
    p.health=number(d[7]) and d[7] or 100
    p.maxHealth=number(d[8]) and d[8] or 100
    p.scale=number(d[9]) and d[9] or 35
    p.skinColor=d[10] or 0;p.clan=type(d[13])=="string" and d[13] or nil
    p.morph=d[14];p.dive=d[15];p.invisible=d[16];p.disguised=d[17]
    self.players[id]=p
    return true
  elseif name=="a" then
    local positions,attrs,hidden=array(args[1]),array(args[2]),array(args[3])
    -- Positions are flattened groups of FOUR. There is no interpolation/fake prediction.
    for i=1,#positions-3,4 do
      local sid,x,y,dir=positions[i],positions[i+1],positions[i+2],positions[i+3]
      if validId(sid) and number(x) and number(y) and number(dir) then
        local p=self.players[sid] or {sid=sid,scale=35,health=100,maxHealth=100}
        receivePosition(p,x,y,dir/100)
        self.players[sid]=p
      end
    end
    -- Attributes are flattened groups of TEN.
    for i=1,#attrs-9,10 do
      local sid=attrs[i]
      if validId(sid) then
        local p=self.players[sid] or {sid=sid}
        p.buildIndex=attrs[i+1];p.weaponIndex=attrs[i+2];p.variant=attrs[i+3]
        p.team=type(attrs[i+4])=="string" and attrs[i+4] or nil
        p.isLeader=attrs[i+5]
        p.skin=type(attrs[i+6])=="number" and attrs[i+6] or 0
        p.tail=type(attrs[i+7])=="number" and attrs[i+7] or 0
        p.icon=attrs[i+8]
        p.zIndex=type(attrs[i+9])=="number" and attrs[i+9] or 0
        self.players[sid]=p
      end
    end
    for _,sid in ipairs(hidden) do self.players[sid]=nil end
    return true
  elseif name=="H" then
    -- Objects: [sid,x,y,dir,scale,type,id,ownerSid] * N.
    local data=array(args[1])
    for i=1,#data-7,8 do
      local sid,x,y=data[i],data[i+1],data[i+2]
      if validId(sid) and number(x) and number(y) then
        self.objects[sid]={sid=sid,x=x,y=y,dir=data[i+3],scale=data[i+4],
          type=data[i+5],
          id=type(data[i+6])=="number" and data[i+6] or nil,
          owner=data[i+7]}
      end
    end
    return true
  elseif name=="I" then
    -- Animals: [sid,index,x,y,dir*100,health,nameIndex,state] * N; hidden IDs.
    local data,hidden=array(args[1]),array(args[2])
    for i=1,#data-7,8 do
      local sid,x,y=data[i],data[i+2],data[i+3]
      if validId(sid) and number(x) and number(y) then
        local ai=self.animals[sid] or {sid=sid}
        ai.index=data[i+1]
        receivePosition(ai,x,y,number(data[i+4]) and data[i+4]/100 or 0)
        ai.health=data[i+5];ai.nameIndex=data[i+6];ai.state=data[i+7]
        self.animals[sid]=ai
      end
    end
    for _,sid in ipairs(hidden) do self.animals[sid]=nil end
    return true
  elseif name=="J" then
    -- The JavaScript client invokes findAIBySID(sid):startAnim().
    local ai=self.animals[args[1]]
    if ai then Animation.animal(ai) end
    return true
  elseif name=="K" then
    -- sid, didHit, weaponIndex, optional skin attack-speed multiplier.
    local p=self.players[args[1]]
    if p then
      local weapon=Catalog.weaponById(args[3])
      Animation.player(p,args[2],weapon,args[4])
    end
    return true
  elseif name=="Q" then
    if validId(args[1]) then self.objects[args[1]]=nil end
    return true
  elseif name=="O" then
    local p=self.players[args[1]]
    if p and number(args[2]) then p.health=args[2] end
    return true
  elseif name=="E" then
    -- E carries the socket ID, unlike the numeric SID in player-position snapshots.
    for sid,p in pairs(self.players) do
      if p.id==args[1] then self.players[sid]=nil end
    end
    return true
  elseif name=="R" then
    -- client/src/index.js killObjects(ownerSid): remove every item of that owner.
    local ownerSid=args[1]
    if validId(ownerSid) then
      for sid,o in pairs(self.objects) do
        if o.owner==ownerSid then self.objects[sid]=nil end
      end
    end
    return true
  elseif name=="L" then
    local direction,sid=args[1],args[2]
    local o=self.objects[sid]
    if o and number(direction) then
      o.wiggleX=(o.wiggleX or 0)+10*math.cos(direction)
      o.wiggleY=(o.wiggleY or 0)+10*math.sin(direction)
    end
    return true
  elseif name=="M" then
    local sid,dir=args[1],args[2]
    if self.objects[sid] and number(dir) then self.objects[sid].dir=dir end
    return true
  elseif name=="X" then
    -- Projectile: x,y,dir,remainingRange,speed,projectileType,layer,sid.
    local x,y,dir,range,speed,typ,layer,sid=
      args[1],args[2],args[3],args[4],args[5],args[6],args[7],args[8]
    if number(x) and number(y) and number(dir) and number(range)
      and number(speed) and validId(sid) then
      self.projectiles[sid]={sid=sid,x=x,y=y,dir=dir,range=range,
        speed=speed,indx=typ,layer=layer or 0,skipMov=true}
    end
    return true
  elseif name=="Y" then
    local p=self.projectiles[args[1]]
    if p and number(args[2]) then p.range=args[2] end
    return true
  elseif name=="P" then
    self.dead=true;self.spawned=false
    return true
  elseif name=="N" then
    -- Resource type is a string; the server sends an absolute value when flag=1.
    if type(args[1])=="string" and number(args[2]) then
      if args[3]==1 then self.resources[args[1]]=args[2]
      else self.resources[args[1]]=(self.resources[args[1]] or 0)+args[2] end
    end
    return true
  elseif name=="V" then
    local data=array(args[1])
    if args[2]==1 then self.inventory.weapons=data
    elseif args[2]==0 then self.inventory.items=data end
    return true
  elseif name=="T" then
    if number(args[1]) then self.xp=args[1] end
    if number(args[2]) then self.maxXP=args[2] end
    if number(args[3]) then self.age=args[3] end
    return true
  elseif name=="U" then
    if number(args[1]) then self.upgradePoints=args[1] end
    if number(args[2]) then self.upgradeAge=args[2] end
    return true
  elseif name=="G" then
    local list=array(args[1]);self.leaderboard={}
    for i=1,#list-2,3 do
      self.leaderboard[#self.leaderboard+1]={sid=list[i],name=list[i+1],score=list[i+2]}
    end
    return true
  end
  return false
end
function World:update(dt)
  if type(dt)~="number" or dt<=0 then return end
  for _,group in ipairs({self.players,self.animals}) do
    for _,entity in pairs(group) do
      Animation.update(entity,dt)
      if entity.interp then
        entity.interp=math.min(1.7,entity.interp+dt*1000/170)
        entity.visualX=entity.fromX+(entity.toX-entity.fromX)*entity.interp
        entity.visualY=entity.fromY+(entity.toY-entity.fromY)*entity.interp
      end
    end
  end
  for _,o in pairs(self.objects) do
    if type(o.id)=="number" then
      local item=Catalog.itemById(o.id)
      if item and item.turnSpeed then
        o.dir=(o.dir or 0)+item.turnSpeed*dt*1000
      end
    end
    o.wiggleX=(o.wiggleX or 0)*(0.99^(dt*1000))
    o.wiggleY=(o.wiggleY or 0)*(0.99^(dt*1000))
  end
  for sid,p in pairs(self.projectiles) do
    if p.skipMov then
      p.skipMov=false
    else
      local distance=p.speed*dt*1000
      distance=math.min(distance,p.range)
      p.x=p.x+distance*math.cos(p.dir)
      p.y=p.y+distance*math.sin(p.dir)
      p.range=p.range-distance
      if p.range<=0 then self.projectiles[sid]=nil end
    end
  end
end
function World:localPlayer()
  return self.sid and self.players[self.sid] or nil
end
return World
