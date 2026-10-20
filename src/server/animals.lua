-- Animal population and initial AI movement based on:
-- al007ex/moomoo-clone@06f7c1ca965a7628671676c8d9a7efd3997bb5e7
-- server/src/moomoo/server.js (animalPosition/ensureAnimals),
-- server/src/moomoo/modules/ai.js (non-boss idle/chase movement).
-- NOTE: boss attacks/dive, poison, drops special to effects and all AI quirks
-- are NOT ported; this is an explicit partial, authoritative server system.
local Types=require("src.game.animals")
local Geo=require("src.game.geometry")
local M={}
M.__index=M
local pi=math.pi
local pi2=pi*2
local function randint(r,a,b) return math.floor(r()*(b-a+1))+a end
local function randfloat(r,a,b) return r()*(b-a+1)+a end -- JS UTILS.randFloat
local function distance(x,y,a,b)
  local dx,dy=x-a,y-b
  return math.sqrt(dx*dx+dy*dy)
end
local function angle(y,x)
  if math.atan2 then return math.atan2(y,x) end
  if x>0 then return math.atan(y/x) end
  if x<0 then return math.atan(y/x)+(y>=0 and pi or -pi) end
  if y>0 then return pi/2 end
  if y<0 then return -pi/2 end
  return 0
end
local function round(v) return math.floor(v+0.5) end
local function insidePool(c,x,y,margin)
  for _,p in ipairs(c.secretPool.pool) do
    if distance(x,y,p[1],p[2])<=p[3]-margin then return true end
  end
  return false
end
function M.new(world,opts)
  opts=opts or {}
  local manager=setmetatable({world=world,config=world.config,
    random=opts.random or world.random or math.random,list={},nextSid=0},M)
  if opts.populate~=false then manager:ensure() end
  return manager
end
function M:secretPoint(scale)
  local pools=self.config.secretPool.pool
  local r=self.random
  for _=1,50 do
    local p=pools[randint(r,1,#pools)]
    local a=r()*pi2
    local rad=r()*(p[3]-scale)
    local x=p[1]+math.cos(a)*rad
    local y=p[2]+math.sin(a)*rad
    if Geo.secretDistance(x+scale,y,self.config)<=0 then return x,y end
  end
  return pools[1][1],pools[1][2]
end
function M:position(plan,data)
  local c=self.config
  local r=self.random
  if plan.positions and #plan.positions>0 then
    local p=plan.positions[1]
    if p.x then return p.x,p.y end
    return round(c.mapScale*p.xRatio),round(c.mapScale*p.yRatio)
  end
  if plan.area=="secret" then return self:secretPoint(data.scale) end
  for _=1,40 do
    local x=randint(r,data.scale,c.mapScale-data.scale)
    local y=randint(r,data.scale,c.mapScale-data.scale)
    if plan.area=="snow" then
      y=randint(r,data.scale,c.snowBiomeTop-data.scale)
    elseif plan.area=="river" then
      y=randint(r,c.mapScale/2-c.riverWidth,c.mapScale/2+c.riverWidth)
    end
    if self.world:canPlace(x,y,data.scale,0.6,true) then return x,y end
  end
  return randint(r,0,c.mapScale),randint(r,0,c.mapScale)
end
function M:spawn(typeId,x,y)
  local def=assert(Types.byId(typeId),"invalid animal type")
  local r=self.random
  local animal={
    sid=self.nextSid,index=typeId,name=def.name or def.src,
    x=x,y=y,startX=def.fixedSpawn and x or nil,startY=def.fixedSpawn and y or nil,
    xVel=0,yVel=0,zIndex=0,dir=randfloat(r,-pi,pi),scale=def.scale,
    health=def.health,maxHealth=def.health,weightM=def.weightM or 1,
    speed=def.speed or 0,turnSpeed=def.turnSpeed or 0,
    hostile=def.hostile or false,chargePlayer=def.chargePlayer or false,
    viewRange=def.viewRange or 0,hitRange=def.hitRange,
    hitDelay=def.hitDelay or 0,hitWait=0,waitCount=1000,moveCount=0,
    targetDir=0,runFrom=nil,chargeTarget=nil,
    active=true,alive=true,lockMove=false,submerged=false,
    spawnDelay=typeId==11 and 600000 or def.spawnDelay,
    spawnCounter=0,damage=def.dmg or 0,drop=def.drop,
    colDmg=def.colDmg or 0,killScore=def.killScore or 0,
    fixedSpawn=def.fixedSpawn or false,boss=def.boss or false,
    state=0,lastContact=0
  }
  self.nextSid=self.nextSid+1
  self.list[#self.list+1]=animal
  return animal
end
function M:ensure()
  local plans=self.config.server.animalSpawnPlan
  for _,plan in ipairs(plans) do
    local existing=0
    for _,animal in ipairs(self.list) do
      if animal.active and animal.index==plan.index then existing=existing+1 end
    end
    local def=assert(Types.byId(plan.index))
    for _=existing+1,plan.desired do
      local x,y=self:position(plan,def)
      self:spawn(plan.index,x,y)
    end
  end
  return self.list
end
local function collisionRadius(o)
  if o.isItem or o.type==2 or o.type==3 or o.type==4 then
    return o.scale*(o.colDiv or 1)
  end
  return o.scale*0.6*(o.colDiv or 1)
end
function M:moveAnimal(a,delta)
  local c=self.config
  local charging=false
  if a.boss then
    -- Crab King has its own separate dive/boss AI; waiting for exact port.
    return false
  end
  local slow=1
  if a.x>=0 and Geo.isRiver(a.x,a.y,c) then
    slow=0.33
    a.xVel=a.xVel+c.waterCurrent*delta
  end
  if a.lockMove then
    a.xVel,a.yVel=0,0
  elseif a.waitCount>0 then
    a.waitCount=a.waitCount-delta
    if a.waitCount<=0 then
      a.chargeTarget=nil
      if a.chargePlayer then
        local target,nearest=nil,math.huge
        for _,p in pairs(self.players or {}) do
          if p.alive then
            local d=distance(a.x,a.y,p.x,p.y)
            if d<=a.viewRange and d<nearest then target=p;nearest=d end
          end
        end
        if target then
          a.chargeTarget=target
          a.moveCount=randint(self.random,8000,12000)
        else
          a.moveCount=randint(self.random,1000,2000)
          a.targetDir=randfloat(self.random,-pi,pi)
        end
      else
        a.moveCount=randint(self.random,4000,10000)
        a.targetDir=randfloat(self.random,-pi,pi)
      end
    end
  elseif a.moveCount>0 then
    local speed=a.speed*slow
    if a.chargeTarget and a.chargeTarget.alive then
      a.targetDir=angle(a.chargeTarget.y-a.y,a.chargeTarget.x-a.x)
      speed=speed*1.75
      charging=true
    end
    if a.hitWait>0 then speed=speed*0.3 end
    if a.dir~=a.targetDir then
      a.dir=a.dir%pi2
      local net=(a.dir-a.targetDir+pi2)%pi2
      local amount=math.min(math.abs(net-pi2),net,a.turnSpeed*delta)
      local sign=net-pi>=0 and 1 or -1
      a.dir=(a.dir+sign*amount+pi2)%pi2
    end
    a.xVel=a.xVel+speed*delta*math.cos(a.dir)
    a.yVel=a.yVel+speed*delta*math.sin(a.dir)
    a.moveCount=a.moveCount-delta
    if a.moveCount<=0 then
      a.chargeTarget=nil
      a.waitCount=a.hostile and 1500 or randint(self.random,1500,6000)
    end
  end
  local dist=math.sqrt((a.xVel*delta)^2+(a.yVel*delta)^2)
  local depth=math.min(4,math.max(1,round(dist/40)))
  for _=1,depth do
    a.x=a.x+a.xVel*delta/depth
    a.y=a.y+a.yVel*delta/depth
    for _,o in ipairs(self.world.objects) do
      if o.active and not o.ignoreCollision then
        local dx,dy=a.x-o.x,a.y-o.y
        local scale=a.scale+collisionRadius(o)
        local d=math.sqrt(dx*dx+dy*dy)
        if d<=scale then
          local ux,uy=1,0
          if d>0 then ux,uy=dx/d,dy/d end
          a.x=o.x+ux*scale
          a.y=o.y+uy*scale
          a.xVel=a.xVel*0.75
          a.yVel=a.yVel*0.75
        end
      end
    end
  end
  a.xVel=a.xVel*c.playerDecel^delta
  a.yVel=a.yVel*c.playerDecel^delta
  if a.x<a.scale then a.x=a.scale;a.xVel=0 end
  if a.x>c.mapScale-a.scale then a.x=c.mapScale-a.scale;a.xVel=0 end
  if a.y<a.scale then a.y=a.scale;a.yVel=0 end
  if a.y>c.mapScale-a.scale then a.y=c.mapScale-a.scale;a.yVel=0 end
  return charging
end
function M:tick(delta,players)
  self.players=players
  for _,a in ipairs(self.list) do
    if a.active then
      if a.spawnCounter>0 then
        a.spawnCounter=a.spawnCounter-delta
        if a.spawnCounter<=0 then
          a.spawnCounter=0
          a.x=a.startX or randint(self.random,a.scale,self.config.mapScale-a.scale)
          a.y=a.startY or randint(self.random,a.scale,self.config.mapScale-a.scale)
          a.health=a.maxHealth
          a.alive=true
        end
      elseif a.alive then
        local charging=self:moveAnimal(a,delta)
        if charging and a.damage>0 then
          for _,p in pairs(players) do
            if p.alive and distance(a.x,a.y,p.x,p.y)<=a.scale+p.scale then
              if a.hitRange then
                if a.hitWait<=0 then a.hitWait=a.hitDelay end
              else
                -- Contact damage follows a charging AI's body collision.
                p.health=math.max(0,p.health-a.damage)
                if p.health<=0 then p.alive=false end
              end
            end
          end
        end
        if a.hitWait>0 then a.hitWait=math.max(0,a.hitWait-delta) end
      end
    end
  end
end
function M:hit(a,player,weapon)
  if not a.alive or a.submerged then return false end
  a.health=a.health-(weapon.dmg or 0)
  local dx,dy=a.x-player.x,a.y-player.y
  local dist=math.sqrt(dx*dx+dy*dy)
  if dist>0 then
    local force=0.3*a.weightM+(weapon.knock or 0)
    a.xVel=a.xVel+force*dx/dist
    a.yVel=a.yVel+force*dy/dist
  end
  if a.health<=0 then
    a.health=a.maxHealth
    player.points=player.points+a.killScore
    if a.drop then
      for i=1,#a.drop,2 do
        local resource=a.drop[i]
        player[resource]=(player[resource] or 0)+a.drop[i+1]
      end
    end
    a.chargeTarget=nil
    a.waitCount=1000
    if a.spawnDelay then
      a.spawnCounter=a.spawnDelay
      a.alive=false
      a.x,a.y=-1000000,-1000000
    else
      a.x=a.startX or randint(self.random,a.scale,self.config.mapScale-a.scale)
      a.y=a.startY or randint(self.random,a.scale,self.config.mapScale-a.scale)
    end
  elseif a.hostile and a.chargePlayer then
    a.chargeTarget=player
    a.waitCount=0
    a.moveCount=8000
  else
    a.targetDir=angle(a.y-player.y,a.x-player.x)
    a.waitCount=0
    a.moveCount=2000
  end
  return true
end
function M:packet()
  local rows={}
  for _,a in ipairs(self.list) do
    if a.active and a.alive and a.spawnCounter==0 then
      rows[#rows+1]={a.sid,a.index,a.x,a.y,a.dir,a.health,a.name,a.state}
    end
  end
  return {"animals",rows}
end
return M
