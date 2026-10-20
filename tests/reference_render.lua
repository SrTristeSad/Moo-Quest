package.path="./?.lua;./?/init.lua;"..package.path
local C=require("src.game.catalog")
local Objects=require("src.game.reference_objects")
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
  end
end
print("reference client Canvas mappings verified for available Lua runtime")
