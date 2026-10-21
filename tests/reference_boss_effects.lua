package.path="./?.lua;./?/init.lua;"..package.path
local E=require("src.game.reference_boss_effects")
local World=require("src.game.world_state")
local View=require("src.game.reference_view")
local function near(a,b)
  return math.abs(a-b)<0.00001
end
local w=World.new()
assert(#w.bossEffects==0)
assert(w:apply("C",{7}))
-- Actual Node W: kind, x, y, collision radius, duration, optional line end.
assert(w:apply("W",{3,-2500,7200,540,1300}))
local slam=w.bossEffects[1]
assert(slam.kind==E.SLAM and slam.r==540 and slam.life==1300)
assert(w:apply("W",{2,-2600,7200,110,1600}))
assert(w:apply("W",{1,-2500,7200,500,1650}))
assert(w:apply("W",{4,-2500,7200,130,1150,-1500,7200}))
assert(#w.bossEffects==4 and w.bossEffects[4].x2==-1500)
-- Packet W must never be interpreted as an attack or client-side damage.
assert(#w.combatText==0)
assert(w:apply("O",{7,100}) and #w.combatText==0)
w:update(0.5)
assert(near(slam.life,800) and #w.bossEffects==4)
w:update(0.65)
assert(#w.bossEffects==3,"exact 1150ms claw warning expires")
w:update(0.15)
assert(#w.bossEffects==2,"1300ms slam expires")
w:update(0.35)
assert(#w.bossEffects==0,"warnings must not persist after server duration")
-- No packet W means no telegraph: no fake boss behavior.
assert(w:apply("J",{999}) and #w.bossEffects==0)
local count=#w.bossEffects
assert(not w:apply("W",{0,0,0,100,1000}))
assert(not w:apply("W",{5,0,0,100,1000}))
assert(not w:apply("W",{1,0,0,0,1000}))
assert(not w:apply("W",{1,0,0,100,math.huge}))
assert(not w:apply("W",{1,0/0,0,100,1000}))
assert(not w:apply("W",{4,0,0,100,1000}))
assert(not w:apply("W",{4,0,0,100,1000,50000,0}))
assert(#w.bossEffects==count,"bad packets must not allocate effects")
for i=1,150 do assert(w:apply("W",{2,i,0,110,1600})) end
assert(#w.bossEffects==128 and w.bossEffects[1].x==23)
assert(w:apply("C",{7}) and #w.bossEffects==0,
  "respawn must remove warnings from a previous life")
-- The Node I state is authoritative, not client-generated:
-- 0 surface, 1 diving, 2 submerged, 3 emerging.
local boss=w:animalKind(11)
assert(boss and boss.boss)
assert(View.animalOpacity({state=0},boss)==1)
assert(View.animalOpacity({state=1},boss)==0.55)
assert(View.animalOpacity({state=2},boss)==0.2)
assert(View.animalOpacity({state=3},boss)==0.7)
assert(View.animalOpacity({state=2},w:animalKind(4))==1,
  "ordinary wolf must not fade as though it were the boss")
assert(w:apply("I",{{11,11,-2500,7200,0,480000,0,2},{}}))
assert(w.animals[11] and w.animals[11].state==2)
assert(View.animalOpacity(w.animals[11],boss)==0.2)
assert(w:apply("I",{{11,11,-2500,7200,0,480000,0,0},{}}))
assert(View.animalOpacity(w.animals[11],boss)==1)
if love and love.graphics and love.graphics.newCanvas then
  -- These are encounter markers, not imported character/weapon images.
  -- Sample actual Canvas pixels to ensure the areas are distinguishable.
  local gfx=love.graphics
  local canvas=gfx.newCanvas(500,500)
  local camera={zoom=1,worldToScreen=function(_,x,y) return x,y end}
  local function sample(args,x,y)
    local effects={}
    assert(E.add(effects,unpack(args)))
    gfx.push("all")
    gfx.setCanvas(canvas)
    gfx.clear(0,0,0,0)
    E.draw(effects,camera)
    gfx.setCanvas()
    gfx.pop()
    return canvas:newImageData():getPixel(x,y)
  end
  local sr,sg,sb,sa=sample({E.SLAM,250,250,100,1300},300,250)
  assert(sa>0.1 and sr>sg and sg>sb,
    "orange boss slam danger disk must be visible")
  local br,bg,bb,ba=sample({E.SPLASH,250,250,100,1650},350,250)
  assert(ba>0.25 and bb>br and bg>br,
    "surfacing splash must draw a blue/white ring")
  local gr,gg,gb,ga=sample({E.GEYSER,250,250,100,1600},350,250)
  assert(ga>0.25 and gb>gr,
    "geyser must have a visible dotted blue perimeter")
  local cr,cg,cb,ca=sample({E.CLAW,100,250,40,1150,400,250},250,250)
  assert(ca>0.1 and cr>cg and cr>cb,
    "claw needs a visible red corridor along server hit segment")
  local _,_,_,outside=sample({E.CLAW,100,250,40,1150,400,250},250,125)
  assert(outside==0,"claw warning must not cover pixels outside corridor")
end
print("Node Crab King W: splash, geyser, slam, claw, dive states and Canvas passed")
