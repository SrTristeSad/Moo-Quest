-- First game viewport for the reference server. Positions and object types come
-- ONLY from authenticated Node.js packets. No local world generation or fake mobs.
-- Vector outlines are transitional: copyrighted official sprites are not embedded.
local C=require("src.game.config")
local Animals=require("src.game.animals")
local View={}
local pi=math.pi
local function rgb(hex)
  return tonumber(hex:sub(2,3),16)/255,tonumber(hex:sub(4,5),16)/255,tonumber(hex:sub(6,7),16)/255
end
local function fill(hex,alpha)
  local r,g,b=rgb(hex);love.graphics.setColor(r,g,b,alpha or 1)
end
local function circle(x,y,r,color)
  fill(color);love.graphics.circle("fill",x,y,r)
end
local function ring(x,y,r,color,width)
  fill(color);love.graphics.setLineWidth(width or 3);love.graphics.circle("line",x,y,r)
end
local function visible(entity,camera,w,h)
  local x,y=camera:worldToScreen(entity.x,entity.y)
  local margin=(entity.scale or 120)*camera.zoom+60
  return x>-margin and x<w+margin and y>-margin and y<h+margin
end
local function ground(camera,w,h)
  -- Terrain thresholds and colors follow the reference client render loop.
  fill("#b6db66");love.graphics.rectangle("fill",0,0,w,h)
  local _,snowBottom=camera:worldToScreen(0,C.snowBiomeTop)
  local _,desertTop=camera:worldToScreen(0,C.mapScale-C.snowBiomeTop)
  fill("#ffffff")
  if snowBottom>0 then love.graphics.rectangle("fill",0,0,w,math.min(h,snowBottom)) end
  fill("#dbc666")
  if desertTop<h then love.graphics.rectangle("fill",0,math.max(0,desertTop),w,h-math.max(0,desertTop)) end
  local _,riverTop=camera:worldToScreen(0,C.mapScale/2-C.riverWidth/2)
  local _,riverBottom=camera:worldToScreen(0,C.mapScale/2+C.riverWidth/2)
  local sy=math.max(0,riverTop- C.riverPadding*camera.zoom)
  local ey=math.min(h,riverBottom+C.riverPadding*camera.zoom)
  if sy<ey then
    fill("#dbc666");love.graphics.rectangle("fill",0,sy,w,ey-sy)
    fill("#91b2db")
    local wy=math.max(0,riverTop);local wh=math.min(h,riverBottom)-wy
    if wh>0 then love.graphics.rectangle("fill",0,wy,w,wh) end
  end
  -- Thin outside-map overlay, as in the reference client.
  local x0,y0=camera:worldToScreen(0,0)
  local x1,y1=camera:worldToScreen(C.mapScale,C.mapScale)
  love.graphics.setColor(0,0,0,0.09)
  if x0>0 then love.graphics.rectangle("fill",0,0,math.min(w,x0),h) end
  if x1<w then love.graphics.rectangle("fill",math.max(0,x1),0,w-math.max(0,x1),h) end
  if y0>0 then love.graphics.rectangle("fill",0,0,w,math.min(h,y0)) end
  if y1<h then love.graphics.rectangle("fill",0,math.max(0,y1),w,h-math.max(0,y1)) end
end
local function drawObject(o,camera)
  local x,y=camera:worldToScreen(o.x,o.y)
  local scale=(tonumber(o.scale) or 70)*camera.zoom
  local t=o.type
  if t==0 then
    -- Tree: original resource type 0. Uses a compact outlined canopy until
    -- artwork with redistribution permission is available.
    circle(x,y,scale*0.51,"#326e2b")
    ring(x,y,scale*0.51,"#254b21",3)
    circle(x-scale*0.18,y-scale*0.16,scale*0.30,"#4c9e32")
    circle(x+scale*0.18,y-scale*0.10,scale*0.29,"#65b63a")
  elseif t==1 then
    circle(x,y,scale*0.5,"#429437")
    ring(x,y,scale*0.5,"#2e722f",3)
    circle(x-scale*0.12,y-scale*0.10,scale*0.22,"#69b543")
  elseif t==2 or t==3 then
    circle(x,y,scale*0.48,t==3 and "#c9b24c" or "#8e908a")
    ring(x,y,scale*0.48,"#6e746d",3)
    circle(x-scale*0.1,y-scale*0.13,scale*0.24,t==3 and "#e4d66b" or "#b7bcb5")
  else
    -- A real structure with a server-issued sid; no locally invented entities.
    circle(x,y,scale*0.48,"#967451")
    ring(x,y,scale*0.48,"#654b35",3)
  end
end
local function drawAnimal(a,camera)
  local x,y=camera:worldToScreen(a.x,a.y)
  local kind=Animals.byId(a.index)
  local size=((kind and kind.scale) or 72)*((kind and kind.spriteMlt) or 1)*camera.zoom*0.5
  circle(x,y,size,(kind and kind.hostile) and "#ad7867" or "#ede3c8")
  ring(x,y,size,"#56463b",3)
  local ang=a.dir or 0
  local ex,ey=math.cos(ang),math.sin(ang)
  circle(x+ex*size*0.45-ey*size*0.18,y+ey*size*0.45+ex*size*0.18,math.max(2,size*0.09),"#29221b")
  circle(x+ex*size*0.45+ey*size*0.18,y+ey*size*0.45-ex*size*0.18,math.max(2,size*0.09),"#29221b")
end
local function drawPlayer(p,camera,localSid)
  local x,y=camera:worldToScreen(p.x,p.y)
  local size=(p.scale or C.playerScale)*camera.zoom
  circle(x,y,size,"#e9d6b4")
  ring(x,y,size,"#4d3b2d",math.max(2,3*camera.zoom))
  local angle=p.dir or 0
  circle(x+math.cos(angle)*size*0.61,y+math.sin(angle)*size*0.61,
    math.max(3,size*0.16),"#443a2d")
  if p.health and p.maxHealth and p.maxHealth>0 and p.health<p.maxHealth then
    local width=72*camera.zoom
    fill("#333333");love.graphics.rectangle("fill",x-width/2,y+size+12,width,8,3,3)
    fill(p.sid==localSid and "#8ecc51" or "#cc5151")
    love.graphics.rectangle("fill",x-width/2+2,y+size+14,
      math.max(0,(width-4)*math.min(1,p.health/p.maxHealth)),4)
  end
  if p.name then
    fill("#ffffff")
    love.graphics.printf(p.name,x-90,y-size-32,180,"center")
  end
end
function View.draw(world,camera)
  local w,h=love.graphics.getDimensions()
  ground(camera,w,h)
  for _,object in pairs(world.objects) do
    if visible(object,camera,w,h) then drawObject(object,camera) end
  end
  for _,animal in pairs(world.animals) do
    if visible(animal,camera,w,h) then drawAnimal(animal,camera) end
  end
  for _,player in pairs(world.players) do
    if player.x and player.y and visible(player,camera,w,h)
      and player.invisible~=1 then drawPlayer(player,camera,world.sid) end
  end
end
return View
