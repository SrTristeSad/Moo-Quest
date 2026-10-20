package.path="./?.lua;./?/init.lua;"..package.path
local C=require("src.game.catalog")
local Objects=require("src.game.reference_objects")
local View=require("src.game.reference_view")
assert(View.playerDrawAngle({dir=1})==1)

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
end
print("reference client Canvas mappings verified for available Lua runtime")
