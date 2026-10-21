package.path="./?.lua;./?/init.lua;"..package.path
local C=require("src.game.catalog")
local Objects=require("src.game.reference_objects")
local View=require("src.game.reference_view")
assert(View.playerDrawAngle({dir=1})==1)
-- The server's K(0) rotation lock and the visual local aim now share
-- the same deterministic rule: no phantom mouse tracking during lock.
assert(View.localAim(false,2.4,1.1)==2.4)
assert(View.localAim(true,2.4,1.1)==1.1)
assert(View.localAim(true,2.4,0)==0,
  "zero-radian locked direction must not be replaced by cursor")
assert(View.localAim(true,2.4,nil)==0,
  "a newly locked direction defaults to the same initial Node aim")
assert(View.localAim(false,0,2.4)==0,
  "an unlocked player must immediately follow the current pointer")
assert(math.abs(View.playerDrawAngle({dir=0,dirPlus=-0.4},
  View.localAim(true,2.4,1.1))-0.7)<0.000001,
  "locked direction must still animate the actual attack swing")
-- Local avatar aims at the cursor without inventing a server direction.
-- Remote avatars MUST keep their own authoritative server direction.
assert(View.playerDrawAngle({dir=1.25,dirPlus=0.1})==1.35)
assert(View.playerDrawAngle({dir=1.25,dirPlus=0.1},0)==0.1,
  "zero-degree local cursor aim must not fall back to server direction")
assert(math.abs(View.playerDrawAngle({dir=1.25,dirPlus=-0.25},2)-1.75)<0.000001,
  "local aiming retains only the original attack swing offset")
assert(View.playerDrawAngle({dir=1.25,dirPlus=0.1},"invalid")==1.35,
  "invalid external direction must not change remote/player fallback")
local World=require("src.game.world_state")
local worldLabels=World.new()
worldLabels.sid=5
worldLabels.players[5]={sid=5,team="Team"}
worldLabels.players[6]={sid=6,team="Team",skin=10}
worldLabels.players[7]={sid=7,team="Enemy",skin=10}
worldLabels.players[8]={sid=8,skin=0}
assert(View.isTeammate(worldLabels,worldLabels.players[5]))
assert(View.isTeammate(worldLabels,worldLabels.players[6]))
assert(not View.isTeammate(worldLabels,worldLabels.players[7]))
assert(View.playerNameVisible(worldLabels,worldLabels.players[6]))
assert(not View.playerNameVisible(worldLabels,worldLabels.players[7]))
assert(View.playerNameVisible(worldLabels,worldLabels.players[8]))
assert(View.animalName({index=0,nameIndex=0})=="Sid")
assert(View.animalName({index=4,nameIndex=0})=="Wolf")
assert(View.animalName({index=100})==nil)
local dynamic=World.new()
assert(dynamic:apply("A",{{animals={{id=0,src="cow_1",scale=100,health=620,name="Server Cow"}}}}))
assert(dynamic:animalKind(0).scale==100)
assert(dynamic:animalKind(0).health==620)
assert(View.animalName({index=0,nameIndex=0},dynamic)=="Server Cow")
assert(View.animalName({index=1,nameIndex=0},dynamic)=="Sid")
assert(View.healthBarOffset(35)==104, "player health bar offset must be scale + nameY below player")
assert(View.healthBarOffset(78)==190, "animal health bar world-coordinate offset must match reference")

local wave=View.advanceWater(0.1)
assert(wave>1 and wave<1.1,"water width must animate according to original waveSpeed")

assert(math.abs(View.playerDrawAngle({dir=1,dirPlus=-0.25})-0.75)<0.0001)

assert(Objects.layer({type=0})==3,"original trees should be upper layer")
assert(Objects.layer({type=2})==0,"original rocks should be lower layer")
assert(Objects.layer({type=4})==-1,"original hidden objects should be lower layer")
assert(Objects.layer({id=3,type=0})==0,"wood walls belong to group 1 / layer 0")
assert(Objects.layer({id=10,type=0})==1,"windmills belong to group 3 / layer 1")
assert(Objects.layer({id=15,type=0})==-1,"pit traps belong to group 5 / layer -1")
assert(C.itemById(22).name=="teleporter","all original build items available")
local trapAlpha,trapBlocker=Objects.renderStyle({id=15,owner=7})
assert(trapAlpha==0.6 and trapBlocker==nil,
  "owner-visible pit trap must retain reference 60% alpha")
local blockerAlpha,blockerRadius=Objects.renderStyle({id=21,owner=7})
assert(blockerAlpha==1 and blockerRadius==300,
  "building blocker must show its original 300-world-unit circle")
local standardAlpha,standardRadius=Objects.renderStyle({id=3})
assert(standardAlpha==1 and standardRadius==nil,
  "ordinary walls must not receive visual effects")
local treeAlpha,treeRadius=Objects.renderStyle({type=0,scale=80})
assert(treeAlpha==1 and treeRadius==nil,
  "world resources must remain fully opaque")
if love and love.graphics and love.graphics.newCanvas then
  -- Rendering is tested for real only when launched inside LÖVE 11.5.
  for typ=0,3 do
    local spr=Objects.sprite({type=typ,scale=80,y=5000})
    assert(spr and spr:typeOf("Canvas"),"missing resource sprite "..typ)
  end
  for id=0,22 do
    local item=C.itemById(id)
    local spr=Objects.sprite({id=id,scale=item.scale})
    assert(spr and spr:typeOf("Canvas"),"missing Canvas item "..id)
    local icon=Objects.sprite({id=id,scale=item.scale},true)
    assert(icon and icon:typeOf("Canvas"),"missing original unrotated icon "..id)
    assert(icon~=spr,"icon must not reuse world-oriented sprite")
  end
  -- The item draw calls must actually paint the reference overlays,
  -- not merely return a Canvas handle. Check the pixels in a headless
  -- software-OpenGL context without needing third-party artwork.
  local gfx=love.graphics
  local canvas=gfx.newCanvas(900,900)
  local function sampleItem(id,px,py)
    gfx.push("all")
    gfx.setCanvas(canvas)
    gfx.clear(0,0,0,0)
    local item=C.itemById(id)
    assert(Objects.draw({id=id,scale=item.scale,dir=0},450,450,1))
    gfx.setCanvas()
    gfx.pop()
    local data=canvas:newImageData()
    return data:getPixel(px,py)
  end
  local red,green,blue,ringAlpha=sampleItem(21,750,450)
  assert(ringAlpha>0.12 and ringAlpha<0.55 and red>green,
    "blocker must render a translucent red radius, not just a normal icon")
  local _,_,_,faded=sampleItem(15,450,450)
  assert(faded>0.35 and faded<0.75,
    "owner-visible trap sprite must be faded in the actual framebuffer")
  local _,_,_,opaque=sampleItem(3,450,450)
  assert(opaque>0.9,
    "ordinary wall sprite should remain opaque")
end
print("reference client Canvas mappings verified for available Lua runtime")
