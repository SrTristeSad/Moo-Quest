package.path="./?.lua;./?/init.lua;"..package.path
local World=require("src.game.world_state")
local U=require("src.game.reference_upgrades")
local w=World.new()
assert(w:apply("C",{0}))
assert(#U.offers(w)==0)
w.upgradePoints=1
w.upgradeAge=2
local choices=U.offers(w)
assert(#choices>=1 and choices[1].kind=="weapon")
assert(choices[1].id==1 and choices[1].index==1,
  "reference first upgrade: hand axe / H index 1")
local screenWidth=1280
local slot=66;local gap=10
local left=(screenWidth-(#choices*slot+(#choices-1)*gap))/2
assert(U.hitTest(w,screenWidth,left+33,43)==choices[1].index)
assert(U.hitTest(w,screenWidth,left+33,120)==nil)
w.upgradePoints=0
assert(U.hitTest(w,screenWidth,left+33,43)==nil)
print("original upgrade choice ordering and packet indices verified")
