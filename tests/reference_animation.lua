package.path="./?.lua;./?/init.lua;"..package.path
local A=require("src.game.reference_animation")
local Catalog=require("src.game.catalog")
local pi=math.pi
local function near(a,b)
  return math.abs(a-b)<0.00001
end
local p={}
assert(A.player(p,1,Catalog.weaponById(0)))
assert(p.animSpeed==300 and near(p.targetAngle,-pi/2))
A.update(p,0.05)
assert(p.dirPlus<0 and near(p.dirPlus,-pi/3),"reference attack windup")
A.update(p,0.025)
assert(near(p.dirPlus,-pi/2),"reference attack reaches hit angle")
A.update(p,0.1125)
assert(near(p.dirPlus,-pi/4),"reference attack return")
A.update(p,0.2)
assert(p.animTime==0 and p.dirPlus==0)
local missed={}
assert(A.player(missed,0,Catalog.weaponById(0),2))
assert(missed.animSpeed==150 and near(missed.targetAngle,-pi))
local wolf={}
assert(A.animal(wolf) and wolf.animTime==600)
A.update(wolf,0.15)
assert(near(wolf.dirPlus,pi*0.8))
A.update(wolf,0.45)
assert(wolf.dirPlus==0 and wolf.animTime==0)
print("reference combat/animal animation timings verified")
