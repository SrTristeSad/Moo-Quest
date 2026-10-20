-- Lua/LÖVE port of the reference Canvas drawing order and sprite rules.
-- Source: al007ex/moomoo-clone/client/src/index.js and client/public/img.
-- No improvised animal, weapon or tree illustrations.
local C=require("src.game.config")
local Catalog=require("src.game.catalog")
local Animals=require("src.game.animals")
local Shapes=require("src.game.reference_primitives")
local Objects=require("src.game.reference_objects")
local Assets=require("src.game.reference_assets")
local View={}
local pi=math.pi
local cos,sin=math.cos,math.sin

local skinColors={
  "#bf8f54","#cbb091","#896c4b","#fadadc","#ececec",
  "#c37373","#4c4c4c","#ecaff7","#738cc3","#8bc373"
}
local variants={[0]="",[1]="_g",[2]="_d",[3]="_r",[4]="_e"}
local hatById,tailById={},{}
for _,v in ipairs(Catalog.hats) do hatById[v.id]=v end
for _,v in ipairs(Catalog.accessories) do tailById[v.id]=v end
local function see(e,camera,w,h,scale)
  if type(e.x)~="number" or type(e.y)~="number" then return false end
  local x,y=camera:worldToScreen(e.x,e.y)
  local s=(scale or e.scale or 120)*camera.zoom
  return x+s>=0 and x-s<=w and y+s>=0 and y-s<=h
end
local function river(camera,w,delta)
  local mid=C.mapScale/2
  local y=camera:worldToScreen(0,mid)
  local bank=(C.riverWidth+C.riverPadding)*camera.zoom
  Shapes.color("#dbc666")
  love.graphics.rectangle("fill",0,y-bank/2,w,bank)
  Shapes.color("#91b2db")
  local water=C.riverWidth*camera.zoom
  love.graphics.rectangle("fill",0,y-water/2,w,water)
end
local function ground(camera,w,h)
  Shapes.color("#b6db66")
  love.graphics.rectangle("fill",0,0,w,h)
  local _,snow=camera:worldToScreen(0,C.snowBiomeTop)
  if snow>0 then
    Shapes.color("#ffffff")
    love.graphics.rectangle("fill",0,0,w,math.min(h,snow))
  end
  local _,desert=camera:worldToScreen(0,C.mapScale-C.snowBiomeTop)
  if desert<h then
    Shapes.color("#dbc666")
    love.graphics.rectangle("fill",0,math.max(0,desert),w,
      h-math.max(0,desert))
  end
  river(camera,w)
end
local function grid(camera,w,h)
  -- Same transparent grid and spacing used by the reference Canvas client.
  love.graphics.setColor(0,0,0,0.06)
  love.graphics.setLineWidth(4)
  local step=h/18
  local x=(-camera.x)%step
  while x<w do
    love.graphics.line(x,0,x,h)
    x=x+step
  end
  local y=(-camera.y)%step
  while y<h do
    love.graphics.line(0,y,w,y)
    y=y+step
  end
end
local function boundaries(camera,w,h)
  local x0,y0=camera:worldToScreen(0,0)
  local x1,y1=camera:worldToScreen(C.mapScale,C.mapScale)
  love.graphics.setColor(0,0,0,0.09)
  if x0>0 then love.graphics.rectangle("fill",0,0,math.min(w,x0),h) end
  if x1<w then love.graphics.rectangle("fill",math.max(0,x1),0,w-math.max(0,x1),h) end
  if y0>0 then love.graphics.rectangle("fill",0,0,w,math.min(h,y0)) end
  if y1<h then love.graphics.rectangle("fill",0,math.max(0,y1),w,h-math.max(0,y1)) end
end

local function drawObjectLayer(world,camera,w,h,layer)
  for _,o in pairs(world.objects) do
    if Objects.layer(o)==layer and see(o,camera,w,h,tonumber(o.scale) or 100) then
      local x,y=camera:worldToScreen(o.x,o.y)
      Objects.draw(o,x,y,camera.zoom)
    end
  end
end
local function renderAnimal(a,camera)
  local kind=Animals.byId(a.index)
  if not kind or not kind.src then return end
  local x,y=camera:worldToScreen(a.x,a.y)
  -- renderAI: tmpScale = scale * 1.2 * spriteMlt
  local radius=kind.scale*1.2*(kind.spriteMlt or 1)*camera.zoom
  Assets.draw("animals",kind.src..".png",x,y,radius*2,radius*2,
    (a.dir or 0)-pi/2)
end
local function drawWeapon(weapon,variant,scale)
  local src=weapon.src..(variants[variant or 0] or "")
  Assets.draw("weapons",src..".png",
    scale+(weapon.xOff or 0),(weapon.yOff or 0),
    weapon.length,weapon.width)
  local proj=type(weapon.projectile)=="number"
    and Catalog.projectiles[weapon.projectile+1] or nil
  if proj and not weapon.hideProjectile and proj.src then
    Assets.draw("weapons",proj.src..".png",scale,0,proj.scale,proj.scale)
  end
end
local function drawTail(player)
  local tailId=player.tail
  local tail=type(tailId)=="number" and tailById[tailId] or nil
  if not tail then return end
  local x=-20-(tail.xOff or 0)
  Assets.draw("accessories","access_"..tailId..".png",x,0,
    tail.scale,tail.scale,tail.spin and (player.skinRot or 0) or 0)
end
local function drawHat(player)
  local hatId=player.skin
  local hat=type(hatId)=="number" and hatById[hatId] or nil
  if not hat then return end
  love.graphics.push()
  love.graphics.rotate(pi/2)
  Assets.draw("hats","hat_"..hatId..".png",0,0,hat.scale,hat.scale)
  if hat.topSprite then
    Assets.draw("hats","hat_"..hatId.."_top.png",0,0,
      hat.scale,hat.scale,player.skinRot or 0)
  end
  love.graphics.pop()
end
local function drawHeldItem(index,scale)
  local item=Catalog.itemById(index)
  if not item then return end
  local image=Objects.sprite({id=index,scale=item.scale})
  if image then
    local center=scale-(item.holdOffset or 0)+image:getWidth()/2
    love.graphics.setColor(1,1,1)
    love.graphics.draw(image,center,0,0,1,1,
      image:getWidth()/2,image:getHeight()/2)
  end
end
local function playerBody(p,dt)
  local scale=p.scale or C.playerScale
  local weapon=Catalog.weaponById(p.weaponIndex or 0)
  local build=type(p.buildIndex)=="number" and p.buildIndex or -1
  local armAngle=(pi/4)*((weapon and weapon.armS) or 1)
  local handAngle=build<0 and ((weapon and weapon.hndS) or 1) or 1
  local handDist=build<0 and ((weapon and weapon.hndD) or 1) or 1
  local col=skinColors[(tonumber(p.skinColor) or 0)+1] or skinColors[1]
  drawTail(p)
  if weapon and build<0 and not weapon.aboveHand then
    drawWeapon(weapon,p.variant,scale)
  end
  Shapes.circle(scale*cos(armAngle),scale*sin(armAngle),14,col,Shapes.outline)
  Shapes.circle(scale*handDist*cos(-armAngle*handAngle),
    scale*handDist*sin(-armAngle*handAngle),14,col,Shapes.outline)
  if weapon and build<0 and weapon.aboveHand then
    drawWeapon(weapon,p.variant,scale)
  end
  if build>=0 then drawHeldItem(build,scale) end
  Shapes.circle(0,0,scale,col,Shapes.outline)
  drawHat(p)
end
local function drawPlayer(p,camera,dt)
  local x,y=camera:worldToScreen(p.x,p.y)
  p.skinRot=(p.skinRot or 0)+dt*1000*0.002
  love.graphics.push()
  love.graphics.translate(x,y)
  love.graphics.rotate(p.dir or 0)
  love.graphics.scale(camera.zoom)
  playerBody(p,dt)
  love.graphics.pop()
end
local function labels(world,camera,w,h)
  for _,p in pairs(world.players) do
    if p.x and p.y and p.invisible~=1 and see(p,camera,w,h) then
      local x,y=camera:worldToScreen(p.x,p.y)
      local scale=(p.scale or C.playerScale)*camera.zoom
      local name=(p.team and "["..tostring(p.team).."] " or "")..
        tostring(p.name or "")
      love.graphics.setColor(1,1,1,1)
      love.graphics.printf(name,x-125,y-scale-39,250,"center")
      if type(p.health)=="number" and type(p.maxHealth)=="number"
        and p.maxHealth>0 and p.health<p.maxHealth then
        local bar=50*2*camera.zoom
        local ratio=math.max(0,math.min(1,p.health/p.maxHealth))
        Shapes.color(Shapes.darkOutline)
        love.graphics.rectangle("fill",x-bar/2-4.5,y+scale+34,bar+9,17,8)
        Shapes.color(p.sid==world.sid and "#8ecc51" or "#cc5151")
        love.graphics.rectangle("fill",x-bar/2,y+scale+38.5,bar*ratio,8,4)
      end
    end
  end
end
function View.draw(world,camera,dt)
  local w,h=love.graphics.getDimensions()
  ground(camera,w,h)
  grid(camera,w,h)
  drawObjectLayer(world,camera,w,h,-1)
  for _,p in pairs(world.players) do
    if (p.zIndex or 0)==0 and p.x and p.y and p.invisible~=1
      and see(p,camera,w,h) then drawPlayer(p,camera,dt or 0) end
  end
  for _,a in pairs(world.animals) do
    local kind=Animals.byId(a.index)
    if kind and see(a,camera,w,h,kind.scale*2.4) then renderAnimal(a,camera) end
  end
  drawObjectLayer(world,camera,w,h,0)
  drawObjectLayer(world,camera,w,h,1)
  for _,p in pairs(world.players) do
    if (p.zIndex or 0)==1 and p.x and p.y and p.invisible~=1
      and see(p,camera,w,h) then drawPlayer(p,camera,dt or 0) end
  end
  drawObjectLayer(world,camera,w,h,2)
  drawObjectLayer(world,camera,w,h,3)
  boundaries(camera,w,h)
  labels(world,camera,w,h)
end
return View
