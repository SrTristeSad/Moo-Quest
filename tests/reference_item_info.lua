package.path="./?.lua;./?/init.lua;"..package.path
local World=require("src.game.world_state")
local Hud=require("src.game.reference_hud")
local Info=require("src.game.reference_item_info")
local Upgrades=require("src.game.reference_upgrades")
local Catalog=require("src.game.catalog")
local w=World.new()
assert(w:apply("C",{4}))
local width,height=1280,720
local inventory=w.inventory
local count=#inventory.weapons+#inventory.items
local x=(width-(count*76-10))/2
local hammer=Hud.hoveredItem(w,width,height,x+33,height-55)
assert(hammer and hammer.kind=="weapon" and hammer.id==0)
local detail=Info.describe(hammer,w)
assert(detail.name=="Tool hammer" and detail.class=="primary")
assert(detail.description=="tool for gathering all resources")
assert(#detail.requirements==0)
local apple=Hud.hoveredItem(w,width,height,x+76+33,height-55)
assert(apple and apple.kind=="item" and apple.id==0)
local nutrition=Info.describe(apple,w)
assert(nutrition.name=="Apple" and nutrition.requirements[1].name=="food")
assert(nutrition.requirements[1].amount==10)
local wall=Hud.hoveredItem(w,width,height,x+2*76+33,height-55)
local def=Info.describe(wall,w)
assert(def.name=="Wood wall" and def.requirements[1].name=="wood")
assert(def.requirements[1].amount==10 and def.limit==30 and def.count==0)
assert(w:apply("S",{1,5}))
assert(Info.describe(wall,w).count==5,"show original authoritative S item counts")
assert(Hud.hoveredItem(w,width,height,x+70,height-55)==nil,
  "gap between slots must never show unrelated item tooltip")
assert(Hud.hoveredItem(w,width,height,x+33,height-90)==nil)
w.upgradePoints=1;w.upgradeAge=2
local offers=Upgrades.offers(w)
assert(#offers>0)
local upgradeStart=(width-(#offers*76-10))/2
local offer=Hud.hoveredItem(w,width,height,upgradeStart+33,43)
assert(offer and offer.id==offers[1].id and offer.kind==offers[1].kind)
for id=0,22 do
  local item=Catalog.itemById(id)
  local d=Info.describe({kind="item",data=item},w)
  assert(d and d.name and d.description,"missing catalog description for item "..id)
end
for id=0,15 do
  local weapon=Catalog.weaponById(id)
  local d=Info.describe({kind="weapon",data=weapon},w)
  assert(d and (d.class=="primary" or d.class=="secondary"))
end
if love and love.graphics and love.graphics.newFont then
  assert(Info.draw(wall,w),"LÖVE Canvas item details must render")
  assert(Info.draw(hammer,w),"LÖVE Canvas weapon details must render")
end
print("real reference tooltips for 23 items, 16 weapons, upgrade offers and Node S build limits passed")
