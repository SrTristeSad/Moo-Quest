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
-- The same displayed slots drive mouse clicks and keyboard selection.
local function assertSlot(key,x,expectedId,expectedWeapon)
  local viaKey,isWeapon=Hud.slotForKey(w,key)
  local viaMouse,mouseWeapon=Hud.hitTest(w,width,height,x,y)
  assert(viaKey==expectedId and isWeapon==expectedWeapon)
  assert(viaMouse==viaKey and mouseWeapon==isWeapon)
end
assertSlot("1",start+33,0,true)
assertSlot("2",start+76+33,0,false)
assertSlot("3",start+2*76+33,3,false)
assert(Hud.slotForKey(w,"0")==nil)
assert(Hud.slotForKey(w,"9")==nil)
assert(Hud.slotForKey(w,"kp1")==nil)
-- Merely knowing the player's SID must never invent a selected item.
assert(not Hud.isSelected(w,{kind="weapon",id=0}))
assert(w:apply("D",{{"socket-0",0,"Player",100,200,0,100,100,35,0}}))
assert(not Hud.isSelected(w,{kind="weapon",id=0}),
  "before the Node attrs frame there is no authoritative selection")
-- Node "a" attributes: sid, buildIndex, weaponIndex, variant, team,
-- isLeader, skin, tail, icon, zIndex.
local function serverSelection(build,weaponId)
  assert(w:apply("a",{{0,100,200,0},
    {0,build,weaponId,0,false,0,0,0,0,0},{}}))
end
serverSelection(-1,0)
assert(Hud.isSelected(w,{kind="weapon",id=0}))
assert(not Hud.isSelected(w,{kind="item",id=0}))
assert(not Hud.isSelected(w,{kind="item",id=3}))
serverSelection(3,0)
assert(Hud.isSelected(w,{kind="item",id=3}),
  "server-selected wooden wall is highlighted")
assert(not Hud.isSelected(w,{kind="weapon",id=0}),
  "hammer cannot also be highlighted while building")
serverSelection(-1,0)
assert(not Hud.isSelected(w,{kind="item",id=3}),
  "server deselecting the structure returns to selected hammer")
-- A real server V packet replaces the displayed slots; never use stale IDs.
assert(w:apply("V",{{1},1}))
local nextKey,nextIsWeapon=Hud.slotForKey(w,"1")
assert(nextKey==1 and nextIsWeapon==true)
serverSelection(-1,1)
assert(Hud.isSelected(w,{kind="weapon",id=1}))
assert(not Hud.isSelected(w,{kind="weapon",id=0}))
assert(w:apply("V",{{1,3,6,10},0}))
local foodIndex,foodWeapon=Hud.slotForKey(w,"2")
assert(foodIndex==1 and foodWeapon==false)
assertSlot("3",start+2*76+33,3,false)
-- New life must not keep a prior-life highlight while waiting for Node attrs.
assert(w:apply("P",{}) and w:apply("C",{0}))
assert(not Hud.isSelected(w,{kind="weapon",id=1}))
print("reference clickable and authoritative selected action bar mappings passed")
