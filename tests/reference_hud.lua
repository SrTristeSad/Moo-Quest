package.path="./?.lua;./?/init.lua;"..package.path
local World=require("src.game.world_state")
local Hud=require("src.game.reference_hud")
local w=World.new()
assert(Hud.formatResource(nil)=="0")
assert(Hud.formatResource({})=="0")
assert(Hud.formatResource(0)=="0")
assert(Hud.formatResource(500)=="500")
assert(Hud.formatResource(20000)=="20000")
assert(Hud.formatResource(1000000)=="1000000")

local width,height=1280,720
assert(Hud.hitTest(w,width,height,width/2,height-60)==nil)
assert(w:apply("C",{0}))
local weapons=w.inventory.weapons
local items=w.inventory.items
assert(weapons[1]==0 and items[1]==0)
local count=#weapons+#items
local start=(width-(count*76-10))/2
local y=height-83+33
local id,weapon=Hud.hitTest(w,width,height,start+33,y)
assert(id==0 and weapon==true,"first actionbar slot must select original hammer")
local id2,isWeapon=Hud.hitTest(w,width,height,start+76+33,y)
assert(id2==0 and isWeapon==false,"second actionbar slot must select apple")
local id3,isWeapon3=Hud.hitTest(w,width,height,start+2*76+33,y)
assert(id3==3 and isWeapon3==false,"third actionbar slot must select wooden wall")
assert(Hud.hitTest(w,width,height,start+33,height-90)==nil)
assert(Hud.hitTest(w,width,height,start+33,height-12)==nil)
assert(Hud.hitTest(w,width,height,start+70,y)==nil)
assert(Hud.mapHitTest(width,height,20,height-150))
assert(Hud.mapHitTest(width,height,149,height-21))
assert(not Hud.mapHitTest(width,height,150,height-21))
assert(not Hud.mapHitTest(width,height,21,height-151))
print("reference clickable action bar mappings passed")
