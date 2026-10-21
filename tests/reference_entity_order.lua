package.path="./?.lua;./?/init.lua;"..package.path
local World=require("src.game.world_state")
local View=require("src.game.reference_view")
local Shapes=require("src.game.reference_primitives")
local Assets=require("src.game.reference_assets")
local w=World.new()
assert(w:apply("C",{90}))
local function add(id,sid,color)
  assert(w:apply("D",{{"user_"..id,sid,"Player "..sid,
    7200,7200,0,100,100,35,color}}))
end
local function order(list)
  local ids={}
  for _,obj in ipairs(list) do ids[#ids+1]=obj.sid end
  return table.concat(ids,",")
end
add(90,90,0);add(10,10,1);add(50,50,2)
assert(order(w:orderedPlayers())=="90,10,50",
  "JS addPlayer pushes to players array; Lua SID hash order must not win")
-- Same SID stays at its original position after updates/repeated D.
add(10,10,1)
assert(w:apply("a",{{10,7200,7200,0,50,7200,7200,0},{},{}}))
assert(order(w:orderedPlayers())=="90,10,50")
-- Hide is a temporary visibility change; JavaScript does not splice
-- remote player out of its array until an actual E(removePlayer).
assert(w:apply("a",{{},{},{10}}))
assert(order(w:orderedPlayers())=="90,50")
add(10,10,1)
assert(order(w:orderedPlayers())=="90,10,50",
  "returning hidden player must reclaim prior draw position")
assert(w:apply("E",{"user_10"}))
assert(order(w:orderedPlayers())=="90,50")
add(11,11,3)
assert(order(w:orderedPlayers())=="90,50,11",
  "a newly joined player must append after actual E removal")
-- Animals in the JS are a persistent array with active/visible flags.
local function animal(sid,id)
  return {sid,id,7200,7200,0,100,0,0}
end
local function flatAnimals(...)
  local flat={}
  for _,animalData in ipairs({...}) do
    for _,value in ipairs(animalData) do flat[#flat+1]=value end
  end
  return flat
end
assert(w:apply("I",{flatAnimals(animal(55,0),animal(5,4),animal(88,1)),{}}))
assert(order(w:orderedAnimals())=="55,5,88")
assert(w:apply("I",{flatAnimals(animal(88,1),animal(55,0)),{5}}))
assert(order(w:orderedAnimals())=="55,88")
assert(w:apply("I",{flatAnimals(animal(5,4)),{}}))
assert(order(w:orderedAnimals())=="55,5,88",
  "returning hidden wolf keeps original JS array slot")
local fallback=World.new()
fallback.players[3]={sid=3}
fallback.players[99]={sid=99}
fallback.players[7]={sid=7}
assert(order(fallback:orderedPlayers())=="3,7,99",
  "manually supplied menu/mock entities remain deterministically ordered")
-- Check the actual draw path, including the zIndex=0 player pass
-- and the animal pass; intercept only artwork to record draw order.
if love and love.graphics and love.graphics.newCanvas then
  local gfx=love.graphics
  local canvas=gfx.newCanvas(400,400)
  local origin=Assets.draw
  local circle=Shapes.circle
  local events={}
  Assets.draw=function(category,filename,...)
    if category=="animals" then
      events[#events+1]="animal:"..filename
      return true
    end
    return origin(category,filename,...)
  end
  Shapes.circle=function(x,y,r,color,...)
    if r==35 then
      events[#events+1]="player:"..tostring(color)
    end
    return circle(x,y,r,color,...)
  end
  local camera={zoom=1}
  function camera:worldToScreen(x,y) return x-7000,y-7000 end
  function camera:screenToWorld(x,y) return x+7000,y+7000 end
  gfx.push("all")
  gfx.setCanvas(canvas)
  gfx.clear(0,0,0,0)
  View.draw(w,camera,0,{showGrid=false})
  gfx.setCanvas()
  gfx.pop()
  Shapes.circle=circle
  Assets.draw=origin
  assert(#events>=5,"render must draw actual players and animals")
  assert(events[1]=="player:#bf8f54" and
    events[2]=="player:#896c4b" and
    events[3]=="player:#fadadc",
    "player bodies must use authoritative JS creation order in world draw")
  assert(events[4]=="animal:cow_1.png" and
    events[5]=="animal:wolf_1.png" and
    events[6]=="animal:pig_1.png",
    "animals must render after players with stable arrival order")
end
print("server D/a/E and I: stable player/animal z-order, visibility and LÖVE drawing passed")
