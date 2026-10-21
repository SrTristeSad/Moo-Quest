-- Layout port of reference client/public/css/main.css:
-- topInfoHolder, resourceDisplay, actionBar, mapDisplay and ageBar.
-- This module draws UI only from actual server packets, not fake values.
local C=require("src.game.config")
local Catalog=require("src.game.catalog")
local Objects=require("src.game.reference_objects")
local Icons=require("src.game.reference_icons")
local Assets=require("src.game.reference_assets")
local Upgrades=require("src.game.reference_upgrades")
local H={}
local fontSmall,fontMedium,fontLarge
local function fonts()
  if not fontSmall then
    fontSmall=love.graphics.newFont(13)
    fontMedium=love.graphics.newFont(20)
    fontLarge=love.graphics.newFont(24)
  end
end
local function color(r,g,b,a) love.graphics.setColor(r,g,b,a or 1) end
local function box(x,y,w,h,a)
  color(0,0,0,a or 0.25)
  love.graphics.rectangle("fill",x,y,w,h,4,4)
end
local function number(n)
  -- Font:getWidth / graphics.print expect a string, including before N/G
  -- packets have arrived. A numeric 0 crashed the first playable HUD frame.
  if type(n)~="number" or n~=n then return "0" end
  -- JS updateStatusDisplay uses the literal integer, not k/m abbreviation.
  -- On this server unlimitedResources may legitimately start at 1000000.
  return tostring(math.floor(n))
end
H.formatResource=number
local function resource(name,icon,value,x,y,left,gain)
  local content=number(value)
  local width=math.max(75,fontLarge:getWidth(content)+56)
  if left then
    box(x,y,width,45)
    Assets.draw("resources",icon.."_ico.png",x+23,y+22.5,28,28)
    color(1,1,1);love.graphics.setFont(fontLarge)
    love.graphics.print(content,x+42,y+9)
    if gain and gain.amount>0 then
      color(0.49,0.90,0.35,math.min(1,gain.remaining))
      love.graphics.setFont(fontSmall)
      love.graphics.print("+"..number(gain.amount),x+16,y-21)
    end
  else
    box(x-width,y,width,45)
    Assets.draw("resources",icon.."_ico.png",x-23,y+22.5,28,28)
    color(1,1,1);love.graphics.setFont(fontLarge)
    love.graphics.print(content,x-width+10,y+9)
    if gain and gain.amount>0 then
      color(0.49,0.90,0.35,math.min(1,gain.remaining))
      love.graphics.setFont(fontSmall)
      love.graphics.print("+"..number(gain.amount),x-width+10,y-21)
    end
  end
end
local function minimap(world,w,h)
  -- client/src/index.js renderMinimap: 130x130, bottom 20, left 20.
  local x,y=20,h-150
  local size=130
  box(x,y,size,size)
  for _,ping in ipairs(world.mapPings or {}) do
    local ratio=math.max(0,math.min(1,ping.scale/40))
    color(1,1,1,1-ratio)
    love.graphics.setLineWidth(4)
    love.graphics.circle("line",
      x+ping.x/C.mapScale*size,
      y+ping.y/C.mapScale*size,ping.scale)
  end
  local p=world:localPlayer()
  if p and p.x and p.y then
    color(1,1,1)
    love.graphics.circle("fill",x+p.x/C.mapScale*size,
      y+p.y/C.mapScale*size,7)
  end
  color(1,1,1,0.35)
  local positions=world.minimapData or {}
  for i=1,#positions-1,2 do
    if type(positions[i])=="number" and type(positions[i+1])=="number" then
      love.graphics.circle("fill",x+positions[i]/C.mapScale*size,
        y+positions[i+1]/C.mapScale*size,7)
    end
  end
  local function mark(position,r,g,b)
    if not position then return end
    color(r,g,b)
    local mx=x+position.x/C.mapScale*size
    local my=y+position.y/C.mapScale*size
    love.graphics.setLineWidth(3)
    love.graphics.line(mx-7,my-7,mx+7,my+7)
    love.graphics.line(mx-7,my+7,mx+7,my-7)
  end
  mark(world.lastDeath,252/255,85/255,83/255)
  mark(world.mapMarker,1,1,1)
end
local function leaderboard(world,w)
  local count=math.min(10,#world.leaderboard)
  if count<=0 then return end
  local x,y=w-260,20
  local line=25
  box(x,y,240,18+count*line)
  love.graphics.setFont(fontMedium)
  for i=1,count do
    local entry=world.leaderboard[i]
    local n=string.format("%d. %s",i,tostring(entry.name or "unknown"))
    color(1,1,1)
    love.graphics.print(n:sub(1,18),x+10,y+7+(i-1)*line)
    local score=number(entry.score)
    color(1,1,1)
    love.graphics.print(score,x+230-fontMedium:getWidth(score),
      y+7+(i-1)*line)
  end
end
local function kills(world,w)
  local count=math.max(0,math.floor(world.resources.kills or 0))
  local x=w-260
  local n=math.min(10,#world.leaderboard)
  local y=20+(n>0 and (18+n*25) or 0)+10
  local content=number(count)
  box(x,y,240,44)
  Assets.draw("icons","skull.png",x+213,y+22,30,30)
  color(1,1,1)
  love.graphics.setFont(fontLarge)
  love.graphics.print(content,x+10,y+9)
end
local function ageBar(world,w,h)
  color(1,1,1)
  love.graphics.setFont(fontLarge)
  local label="AGE "..tostring(world.age or 1)
  love.graphics.print(label,(w-fontLarge:getWidth(label))/2,h-142)
  box(w/2-162,h-116,324,20)
  local ratio=0
  if type(world.maxXP)=="number" and world.maxXP>0 then
    ratio=math.max(0,math.min(1,(world.xp or 0)/world.maxXP))
  end
  color(1,1,1)
  love.graphics.rectangle("fill",w/2-157,h-111,314*ratio,10,3,3)
end
local function actionBarEntries(world)
  local weapons=world.inventory.weapons
  local items=world.inventory.items
  local entries={}
  for _,id in ipairs(weapons) do
    if type(id)=="number" then
      local data=Catalog.weaponById(id)
      if data then entries[#entries+1]={kind="weapon",id=id,data=data} end
    end
  end
  for _,id in ipairs(items) do
    if type(id)=="number" then
      local data=Catalog.itemById(id)
      if data then entries[#entries+1]={kind="item",id=id,data=data} end
    end
  end
  return entries
end
local function actionBar(world,w,h)
  local entries=actionBarEntries(world)
  local count=#entries
  if count==0 then return end
  local slot,space=66,10
  local width=count*(slot+space)-space
  local origin=(w-width)/2
  local y=h-83
  for i,entry in ipairs(entries) do
    local x=origin+(i-1)*(slot+space)
    box(x,y,slot,slot)
    Icons.draw(entry.kind,entry.data,x+slot/2,y+slot/2,slot)
    -- Reference showItemInfo() reads itemCounts by groupId.
    -- Display the live group count only for placeable structures.
    if entry.kind=="item" then
      local group=Catalog.groupById(entry.data.groupId)
      if group and group.limit then
        local count=world.itemCounts[group.id] or 0
        love.graphics.setFont(fontSmall)
        local shown=tostring(count).."/"..tostring(group.limit)
        color(1,1,1)
        love.graphics.print(shown,x+slot-4-fontSmall:getWidth(shown),
          y+slot-16)
      end
    end
  end
end
local function chatBox(active,text,w,h)
  if not active then return end
  local bw=math.min(440,w-40)
  local bx=(w-bw)/2
  local by=h-246 -- client CSS #chatHolder bottom:200px
  box(bx,by,bw,46)
  love.graphics.setFont(fontMedium)
  color(1,1,1)
  love.graphics.print((text or "").."|",bx+9,by+10)
end
function H.mapHitTest(w,h,x,y)
  return type(x)=="number" and type(y)=="number"
    and x>=20 and x<150 and y>=h-150 and y<h-20
end
-- Native LÖVE click target maps to original actionBarItem onclick/selectToBuild.
-- CSS: 66 x 66, 5px margins on each side, bottom 17px.
function H.hitTest(world,w,h,x,y)
  if type(x)~="number" or type(y)~="number" then return nil end
  local entries=actionBarEntries(world)
  if #entries==0 then return nil end
  local slot,space=66,10
  local origin=(w-(#entries*(slot+space)-space))/2
  local top=h-83
  if y<top or y>=top+slot then return nil end
  for i,entry in ipairs(entries) do
    local left=origin+(i-1)*(slot+space)
    if x>=left and x<left+slot then
      return entry.id,entry.kind=="weapon"
    end
  end
  return nil
end
function H.draw(world,chatActive,chatText)
  fonts()
  local w,h=love.graphics.getDimensions()
  leaderboard(world,w)
  kills(world,w)
  resource("food","food",world.resources.food,w-20,h-175,
    false,world.resourceGain.food)
  resource("wood","wood",world.resources.wood,w-20,h-120,
    false,world.resourceGain.wood)
  resource("stone","stone",world.resources.stone,w-20,h-65,
    false,world.resourceGain.stone)
  resource("points","gold",world.resources.points,20,h-205,
    true,world.resourceGain.points)
  minimap(world,w,h)
  ageBar(world,w,h)
  actionBar(world,w,h)
  chatBox(chatActive,chatText,w,h)
  Upgrades.draw(world,w)
end
return H
