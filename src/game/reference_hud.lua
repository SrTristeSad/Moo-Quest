-- Layout port of reference client/public/css/main.css:
-- topInfoHolder, resourceDisplay, actionBar, mapDisplay and ageBar.
-- This module draws UI only from actual server packets, not fake values.
local C=require("src.game.config")
local Catalog=require("src.game.catalog")
local Objects=require("src.game.reference_objects")
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
  if type(n)~="number" then return 0 end
  if n>=1000000 then return string.format("%.1fm",n/1000000) end
  if n>=10000 then return string.format("%.1fk",n/1000) end
  return tostring(math.floor(n))
end
local function resource(name,icon,value,x,y,left)
  local content=number(value)
  local width=math.max(75,fontLarge:getWidth(content)+56)
  if left then
    box(x,y,width,45)
    Assets.draw("resources",icon.."_ico.png",x+23,y+22.5,28,28)
    color(1,1,1);love.graphics.setFont(fontLarge)
    love.graphics.print(content,x+42,y+9)
  else
    box(x-width,y,width,45)
    Assets.draw("resources",icon.."_ico.png",x-23,y+22.5,28,28)
    color(1,1,1);love.graphics.setFont(fontLarge)
    love.graphics.print(content,x-width+10,y+9)
  end
end
local function minimap(world,w,h)
  local x,y=20,h-150
  box(x,y,130,130)
  local p=world:localPlayer()
  if p and p.x and p.y then
    color(1,1,1)
    love.graphics.circle("fill",x+p.x/C.mapScale*130,
      y+p.y/C.mapScale*130,3)
  end
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
    if entry.kind=="weapon" then
      Assets.draw("weapons",entry.data.src..".png",
        x+slot/2,y+slot/2,62,62)
    else
      local image=Objects.sprite({id=entry.id})
      if image then
        color(1,1,1)
        love.graphics.draw(image,x+slot/2,y+slot/2,0,
          62/image:getWidth(),62/image:getHeight(),
          image:getWidth()/2,image:getHeight()/2)
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
  resource("food","food",world.resources.food,w-20,h-175)
  resource("wood","wood",world.resources.wood,w-20,h-120)
  resource("stone","stone",world.resources.stone,w-20,h-65)
  resource("points","gold",world.resources.points,20,h-205,true)
  minimap(world,w,h)
  ageBar(world,w,h)
  actionBar(world,w,h)
  chatBox(chatActive,chatText,w,h)
  Upgrades.draw(world,w)
end
return H
