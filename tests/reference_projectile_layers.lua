package.path="./?.lua;./?/init.lua;"..package.path
local World=require("src.game.world_state")
local View=require("src.game.reference_view")
local Objects=require("src.game.reference_objects")
local Catalog=require("src.game.catalog")
local Assets=require("src.game.reference_assets")
local w=World.new()
assert(w:apply("C",{5}))
-- Original objectManager uses an ARRAY, in Node H receive order.
local function send(...)
  assert(w:apply("H",{{...}}))
end
send(90,7200,7200,0,50,4,3,5,
     10,7200,7200,0,50,4,3,6,
     50,7200,7200,0,50,4,3,7)
local function order()
  local result={}
  for _,o in ipairs(w:orderedObjects()) do result[#result+1]=o.sid end
  return table.concat(result,",")
end
assert(order()=="90,10,50",
  "same-layer overlapping items must preserve JS insertion slots, not SID sort")
-- A reissued H packet for an existing SID updates it IN PLACE.
send(10,7250,7220,0,50,4,3,6)
assert(order()=="90,10,50")
assert(w:apply("Q",{10}))
assert(order()=="90,50")
send(70,7200,7200,0,50,4,3,8)
assert(order()=="90,70,50",
  "new object must reuse the first inactive array slot from JS")
-- Removing all structures owned by 5 must free their slots too.
assert(w:apply("R",{5}) and order()=="70,50")
send(91,7200,7200,0,50,4,3,9)
assert(order()=="91,70,50")
assert(w:apply("Q",{90}) and order()=="91,70,50")
-- Test ordered fallback used only by the static reference menu scene.
local menu=World.new()
menu.objects[88]={sid=88}
menu.objects[3]={sid=3}
menu.objects[42]={sid=42}
local sorted=menu:orderedObjects()
assert(sorted[1].sid==3 and sorted[2].sid==42 and sorted[3].sid==88)
-- Projectile type IDs match the actual six archived catalog entries.
assert(#Catalog.projectiles==6)
local kinds={}
for id=0,5 do
  local spec=View.projectileStyle({indx=id})
  assert(spec and spec.radius==Catalog.projectiles[id+1].scale)
  kinds[#kinds+1]=spec
end
assert(kinds[1].src=="arrow_1" and kinds[1].layer==0)
assert(kinds[2].circle and not kinds[2].src and kinds[2].layer==1)
assert(kinds[3].src=="arrow_1" and kinds[3].layer==0)
assert(kinds[4].src=="arrow_1" and kinds[4].layer==0)
assert(kinds[5].circle and kinds[5].layer==1)
assert(kinds[6].src=="bullet_1" and kinds[6].radius==160)
assert(View.projectileStyle({indx=-1})==nil)
assert(View.projectileStyle({indx=6})==nil)
assert(View.projectileStyle({indx=1.5})==nil)
assert(View.projectileStyle({indx="1"})==nil)
-- Node packet X decides type, layer and position. Never manufacture shots.
assert(w:apply("X",{7200,7200,0,100,1.5,1,1,999}))
assert(View.projectileStyle(w.projectiles[999]).circle)
assert(w.projectiles[999].skipMov)
w:update(0.01)
assert(w.projectiles[999].skipMov==false and w.projectiles[999].x==7200)
w:update(0.01)
assert(w.projectiles[999].x==7215 and w.projectiles[999].range==85)
assert(w:apply("Y",{999,2}) and w.projectiles[999].range==2)
w:update(0.01)
assert(w.projectiles[999]==nil)
if love and love.graphics and love.graphics.newCanvas then
  local gfx=love.graphics
  local canvas=gfx.newCanvas(400,400)
  local camera={zoom=1}
  function camera:worldToScreen(x,y) return x-7000,y-7000 end
  function camera:screenToWorld(x,y) return x+7000,y+7000 end
  local function render(world)
    gfx.push("all")
    gfx.setCanvas(canvas)
    gfx.clear(0,0,0,0)
    View.draw(world,camera,0,{showGrid=false})
    gfx.setCanvas()
    gfx.pop()
    return canvas:newImageData()
  end
  -- Stub ONLY the renderer for this ordering assertion. Real resource
  -- sprite and blocker pixels are tested by reference_render.lua.
  local draw=Objects.draw
  local calls={}
  Objects.draw=function(o,...)
    calls[#calls+1]=o.sid
    return true
  end
  w.projectiles={}
  render(w)
  Objects.draw=draw
  assert(table.concat(calls,",")=="91,70,50",
    "the actual View.draw must use server objectManager order")
  -- A live Node projectile has a visible drawing in its target layer.
  local empty=World.new()
  local baseline=render(empty)
  local circleWorld=World.new()
  assert(circleWorld:apply("X",{7200,7200,0,100,1,1,1,99}))
  local withCircle=render(circleWorld)
  local r0,g0,b0=baseline:getPixel(200,200)
  local r1,g1,b1=withCircle:getPixel(200,200)
  assert(math.abs(r0-r1)+math.abs(g0-g1)+math.abs(b0-b1)>0.15,
    "the turret's Node projectile type 1 must paint a real gray circle")
  -- If reference art is installed, image-backed arrows/bullets must
  -- also render. CI art-verification workflow installs all 180 PNGs.
  for _,id in ipairs({0,2,3,5}) do
    local spec=kinds[id+1]
    if Assets.get("weapons",spec.src..".png") then
      local shot=World.new()
      assert(shot:apply("X",{7200,7200,0,100,1,id,spec.layer,200+id}))
      local img=render(shot)
      local changed=false
      for y=140,260,10 do
        for x=140,260,10 do
          local pr,pg,pb=img:getPixel(x,y)
          local br,bg,bb=baseline:getPixel(x,y)
          if math.abs(pr-br)+math.abs(pg-bg)+math.abs(pb-bb)>0.06 then
            changed=true;break
          end
        end
        if changed then break end
      end
      assert(changed,"Node projectile type "..id.." PNG must be visible")
    end
  end
end
print("Node object slots, layered original projectile types and actual Canvas render passed")
