package.path="./?.lua;./?/init.lua;"..package.path
local World=require("src.game.world_state")
local T=require("src.game.reference_combat_text")
local function near(a,b,eps)
  return math.abs(a-b)<(eps or 0.00001)
end
local world=World.new()
assert(#world.combatText==0)
-- Only Node packet 8 creates visual damage/heal numbers. No synthetic
-- damage events may be derived from health snapshots or client attacks.
assert(world:apply("C",{7}))
assert(world:apply("D",{{"sock",7,"Fighter",120,150,0,100,100,35,0}}))
assert(world:apply("O",{7,50}) and #world.combatText==0)
assert(world:apply("8",{120,150,42,1}))
assert(#world.combatText==1)
local hit=world.combatText[1]
assert(hit.text=="42" and hit.color=="damage")
assert(hit.x==120 and hit.y==150 and hit.scale==50 and hit.life==500)
world:update(0.02)
assert(near(hit.y,146.4) and near(hit.scale,64))
assert(near(hit.life,480))
world:update(0.02)
assert(near(hit.scale,75) and near(hit.scaleSpeed,-0.7))
world:update(0.02)
assert(hit.scale<75 and hit.scale>50)
world:update(0.02)
assert(hit.scale==50 and hit.scaleSpeed==0)
world:update(0.42)
assert(#world.combatText==0,"original floating damage lives exactly 500ms")
assert(world:apply("8",{30,60,-13,1}))
assert(world.combatText[1].text=="13" and
  world.combatText[1].color=="healing",
  "negative server values must display positive magnitude in green")
assert(world:apply("8",{-5,0,2.5,0}))
assert(world.combatText[2].text=="2.5")
-- Malformed network values cannot add arbitrary text or grow the render list.
local n=#world.combatText
assert(not world:apply("8",{1,2,"NaN",1}))
assert(not world:apply("8",{1,math.huge,20,1}))
assert(not world:apply("8",{0,0,0/0,1}))
assert(#world.combatText==n)
for i=1,140 do
  assert(world:apply("8",{i,60,10,1}))
end
assert(#world.combatText==128,"cap outstanding text objects")
assert(world.combatText[1].x==13 and world.combatText[128].x==140)
assert(world:apply("C",{7}) and #world.combatText==0,
  "respawn must not display previous life's damage text")
-- Verify real LÖVE font rendering, centering and green tint without assets.
if love and love.graphics and love.graphics.newCanvas then
  local gfx=love.graphics
  local can=gfx.newCanvas(160,120)
  local cam={zoom=1,worldToScreen=function(_,x,y)return x,y end}
  local function render(value)
    local texts={}
    assert(T.spawn(texts,80,60,value))
    gfx.push("all")
    gfx.setCanvas(can)
    gfx.clear(0,0,0,0)
    T.draw(texts,cam)
    gfx.setCanvas()
    gfx.pop()
    local img=can:newImageData()
    local maxA,r0,g0,b0=0,0,0,0
    for y=5,115 do
      for x=5,155 do
        local r,g,b,a=img:getPixel(x,y)
        if a>maxA then maxA,r0,g0,b0=a,r,g,b end
      end
    end
    return maxA,r0,g0,b0
  end
  local alpha,r,g,b=render(42)
  assert(alpha>0.5 and near(r,g,0.03) and near(g,b,0.03),
    "damage text should actually draw white pixels")
  local halpha,hr,hg,hb=render(-13)
  assert(halpha>0.5 and hg>hr and hr>hb,
    "heal text should actually draw light-green pixels")
end
print("Node damage/heal packet 8: 500ms rising text, tint, 128-cap and render passed")
