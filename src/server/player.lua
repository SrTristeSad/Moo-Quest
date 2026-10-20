-- Authoritative movement core, following the base (unequipped) formulas in
-- al007ex/moomoo-clone/server/src/moomoo/modules/player.js
-- baseline 06f7c1ca965a7628671676c8d9a7efd3997bb5e7.
-- This is NOT the complete player port: effects, player/AI collisions, combat,
-- gathering, construction, damage, XP and network messages remain to be ported.
local C=require("src.game.config")
local Geo=require("src.game.geometry")
local Player={}
Player.__index=Player

local function finite(v)
  return type(v)=="number" and v==v and v~=math.huge and v~=-math.huge
end
local function randInt(random,lo,hi)
  return math.floor(random()*(hi-lo+1))+lo
end
local function objectScale(o)
  if o.isItem or o.type==2 or o.type==3 or o.type==4 then
    return o.scale*(o.colDiv or 1)
  end
  return o.scale*0.6*(o.colDiv or 1)
end

function Player.new(world,options)
  assert(type(world)=="table" and type(world.canPlace)=="function","world expected")
  options=options or {}
  local config=options.config or world.config or C
  return setmetatable({
    world=world,config=config,random=options.random or world.random or math.random,
    sid=options.sid or 0,name=options.name or "unknown",
    x=0,y=0,xVel=0,yVel=0,scale=config.playerScale,
    speed=config.playerSpeed,dir=0,moveDir=nil,
    health=100,maxHealth=100,slowMult=1,zIndex=0,
    alive=false,active=false,buildIndex=-1,lockMove=false,
    coldImmune=false,waterImmune=false,moveMult=1
  },Player)
end

function Player:spawn()
  self.alive,self.active=true,true
  self.health,self.maxHealth=100,100
  self.xVel,self.yVel=0,0
  self.moveDir=nil
  self.slowMult=1
  self.dir,self.zIndex=0,0
  self.buildIndex=-1
  for _=1,20 do
    self.x=randInt(self.random,self.scale,self.config.mapScale-self.scale)
    self.y=randInt(self.random,self.scale,self.config.mapScale-self.scale)
    -- The original ignores water at spawn; collision with obstacles is still required.
    if self.world:canPlace(self.x,self.y,self.scale,0.6,true) then break end
  end
  return self.x,self.y
end

function Player:setMoveDir(angle)
  if angle~=nil and not finite(angle) then return false,"invalid direction" end
  self.moveDir=angle
  return true
end

function Player:setAim(angle)
  if not finite(angle) then return false,"invalid aim" end
  self.dir=angle
  return true
end

function Player:keepInWorld(prevX,prevY)
  local c=self.config
  if self.y-self.scale<0 then self.y=self.scale
  elseif self.y+self.scale>c.mapScale then self.y=c.mapScale-self.scale end
  if self.x+self.scale>c.mapScale then self.x=c.mapScale-self.scale end
  if self.x-self.scale<0 and Geo.secretDistance(math.min(self.x,-1),self.y,c)>0 then
    if self.x>=self.scale-1 or prevX>=self.scale then
      self.x=math.max(self.x,self.scale)
      return
    end
    if Geo.secretDistance(prevX,self.y,c)<=0 then
      self.x=prevX
      self.xVel=0
    elseif Geo.secretDistance(self.x,prevY,c)<=0 then
      self.y=prevY
      self.yVel=0
    else
      self.x,self.y=prevX,prevY
      self.xVel,self.yVel=0,0
    end
  end
end

function Player:resolveObjectCollision(object)
  if not object.active or object.ignoreCollision then return false end
  local dx,dy=self.x-object.x,self.y-object.y
  local block=objectScale(object)
  local separation=self.scale+block
  local dist=math.sqrt(dx*dx+dy*dy)
  if dist>separation then return false end
  local nx,ny=1,0
  if dist>0 then nx,ny=dx/dist,dy/dist end
  self.x=object.x+separation*nx
  self.y=object.y+separation*ny
  self.xVel=self.xVel*0.75
  self.yVel=self.yVel*0.75
  return true
end

function Player:tick(delta)
  if not self.alive then return end
  assert(finite(delta) and delta>0 and delta<=1000,"delta milliseconds out of range")
  local c=self.config
  if self.slowMult<1 then self.slowMult=math.min(1,self.slowMult+0.0008*delta) end
  if self.lockMove then
    self.xVel,self.yVel=0,0
  else
    local speedMult=(self.buildIndex>=0 and 0.5 or 1)*self.slowMult*self.moveMult
    if Geo.isSnow(self.y,c) and not self.coldImmune then
      speedMult=speedMult*c.snowSpeed
    end
    if not self.zIndex or self.zIndex==0 then
      if Geo.isRiver(self.x,self.y,c) then
        if self.waterImmune then
          speedMult=speedMult*0.75
          self.xVel=self.xVel+c.waterCurrent*0.4*delta
        else
          speedMult=speedMult*0.33
          self.xVel=self.xVel+c.waterCurrent*delta
        end
      elseif self.x<0 and Geo.inSecretPool(self.x,self.y,c) then
        speedMult=speedMult*(self.waterImmune and 0.75 or 0.33)
      end
    end
    if self.moveDir~=nil then
      self.xVel=self.xVel+math.cos(self.moveDir)*self.speed*speedMult*delta
      self.yVel=self.yVel+math.sin(self.moveDir)*self.speed*speedMult*delta
    end
  end
  -- Original subdivides displacement to avoid tunnelling through colliders.
  local totalDist=math.sqrt((self.xVel*delta)^2+(self.yVel*delta)^2)
  local depth=math.min(4,math.max(1,math.floor(totalDist/40+0.5)))
  for _=1,depth do
    local prevX,prevY=self.x,self.y
    self.x=self.x+self.xVel*delta/depth
    self.y=self.y+self.yVel*delta/depth
    self:keepInWorld(prevX,prevY)
    for _,object in ipairs(self.world.objects) do
      if object.active then self:resolveObjectCollision(object) end
    end
  end
  local factor=c.playerDecel^delta
  self.xVel=self.xVel*factor
  self.yVel=self.yVel*factor
  if math.abs(self.xVel)<=0.01 then self.xVel=0 end
  if math.abs(self.yVel)<=0.01 then self.yVel=0 end
  self:keepInWorld(self.x,self.y)
end

return Player
