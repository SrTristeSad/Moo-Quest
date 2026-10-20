package.path="./?.lua;./?/init.lua;"..package.path
local World=require("src.server.world")
local Animals=require("src.server.animals")
local Types=require("src.game.animals")
local Catalog=require("src.game.catalog")
local world=World.new({random=function() return 0.5 end})
assert(#Types.types==15)
local manager=Animals.new(world)
assert(#manager.list==51,"expected reference animal population")
local counts={}
for _,a in ipairs(manager.list) do
  counts[a.index]=(counts[a.index] or 0)+1
  local def=assert(Types.byId(a.index))
  assert(a.health==def.health and a.maxHealth==def.health)
end
for _,plan in ipairs(world.config.server.animalSpawnPlan) do
  assert(counts[plan.index]==plan.desired, "population count mismatch")
end
local crab
local cow
for _,a in ipairs(manager.list) do
  if a.index==0 and not cow then cow=a end
  if a.index==11 then crab=a end
end
assert(crab and crab.x==-2500 and crab.y==7200)
assert(crab.spawnDelay==600000)
local packet=manager:packet()
assert(packet[1]=="animals" and #packet[2]==51)
local player={isPlayer=true,alive=true,x=cow.x-80,y=cow.y,scale=35,
  health=100,points=0,food=0,xVel=0,yVel=0}
local hammer=Catalog.weaponById(0)
assert(manager:hit(cow,player,hammer))
assert(cow.health==475)
for _=2,20 do manager:hit(cow,player,hammer) end
assert(cow.health==500,"cow respawns after fatal damage")
assert(player.points==150 and player.food==50,"kill score and resource drop")
manager:tick(1000,{})
manager:tick(100,{})
assert(manager.list[1].active)
print("Lua animal population, stats, drop, basic AI and respawn tests passed")
