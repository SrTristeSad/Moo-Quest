-- Authoritative natural-world placement ported from:
-- al007ex/moomoo-clone/server/src/moomoo/server.js (generateWorld)
-- baseline 06f7c1ca965a7628671676c8d9a7efd3997bb5e7.
-- Unlike client-side mock maps, these objects are server-owned game state.
local defaultConfig = require("src.game.config")
local World = {}
World.__index = World

local function randInt(random,lo,hi)
  -- JS UTILS.randInt: Math.floor(Math.random() * (max - min + 1)) + min
  return math.floor(random() * (hi - lo + 1)) + lo
end

local function pick(random,items)
  return items[math.floor(random() * #items) + 1]
end

local function collisionRadius(object,scaleMultiplier)
  -- GameObject.getScale(sM, isItem) from reference.
  if object.isItem or object.type==2 or object.type==3 or object.type==4 then
    return object.scale * (object.colDiv or 1)
  end
  return object.scale * 0.6 * scaleMultiplier * (object.colDiv or 1)
end

function World.new(options)
  options = options or {}
  local random = options.random or math.random
  assert(type(random)=="function","random generator expected")
  return setmetatable({
    config = options.config or defaultConfig,
    random = random,
    objects = {},
    nextSid = 0
  },World)
end

function World:canPlace(x,y,scale,scaleMultiplier,ignoreWater)
  local c=self.config
  for _,object in ipairs(self.objects) do
    if object.active then
      local dx,dy=x-object.x,y-object.y
      local rad=scale + (object.blocker or collisionRadius(object,scaleMultiplier or 0.6))
      if dx*dx+dy*dy < rad*rad then return false end
    end
  end
  local riverTop=c.mapScale/2-c.riverWidth/2
  local riverBottom=c.mapScale/2+c.riverWidth/2
  if not ignoreWater and y>=riverTop and y<=riverBottom then return false end
  return true
end

function World:addNatural(x,y,scale,kind,ignoreWater)
  assert(kind==0 or kind==1 or kind==2 or kind==3,"invalid natural resource type")
  if not self:canPlace(x,y,scale,0.6,ignoreWater) then return nil end
  local object = {
    sid = self.nextSid, x=x, y=y, scale=scale,
    dir=0, type=kind, active=true, layer=(kind==0 and 3 or kind==2 and 0 or 2),
    isItem=false, colDiv=1, owner=nil
  }
  self.nextSid=self.nextSid+1
  self.objects[#self.objects+1]=object
  return object
end

function World:generate()
  local c=self.config
  local areaSize=c.mapScale/c.areaCount
  local riverTop=c.mapScale/2-c.riverWidth/2
  local riverBottom=c.mapScale/2+c.riverWidth/2
  local r=self.random
  for ax=0,c.areaCount-1 do
    for ay=0,c.areaCount-1 do
      local left=ax*areaSize
      local top=ay*areaSize
      local placed,tries=0,0
      while placed<c.treesPerArea and tries<200 do
        tries=tries+1
        local x=randInt(r,left,left+areaSize)
        local y=randInt(r,top,top+areaSize)
        if not (y>=riverTop-100 and y<=riverBottom+100)
          and y<c.mapScale-c.snowBiomeTop
          and self:addNatural(x,y,pick(r,c.treeScales),0,false) then
          placed=placed+1
        end
      end
      placed,tries=0,0
      while placed<c.bushesPerArea and tries<200 do
        tries=tries+1
        local x=randInt(r,left,left+areaSize)
        local y=randInt(r,top,top+areaSize)
        if not (y>=riverTop-50 and y<=riverBottom+50)
          and self:addNatural(x,y,pick(r,c.bushScales),1,false) then
          placed=placed+1
        end
      end
    end
  end
  local placed,tries=0,0
  while placed<c.totalRocks and tries<5000 do
    tries=tries+1
    if self:addNatural(randInt(r,0,c.mapScale),randInt(r,0,c.mapScale),
      pick(r,c.rockScales),2,true) then
      placed=placed+1
    end
  end
  placed,tries=0,0
  while placed<c.goldOres and tries<5000 do
    tries=tries+1
    if self:addNatural(randInt(r,0,c.mapScale),randInt(r,0,c.mapScale),
      pick(r,c.rockScales),3,true) then
      placed=placed+1
    end
  end
  return self.objects
end

function World:countByType()
  local counts={[0]=0,[1]=0,[2]=0,[3]=0}
  for _,object in ipairs(self.objects) do
    if object.active then counts[object.type]=(counts[object.type] or 0)+1 end
  end
  return counts
end

return World
