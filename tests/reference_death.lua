package.path="./?.lua;./?/init.lua;"..package.path
local Death=require("src.game.reference_death")
local Config=require("src.game.config")
local World=require("src.game.world_state")
local d=Death.new()
assert(Config.deathFadeout==3000)
assert(Death.DURATION==3)
assert(not d.active and d:fontSize()==0)
local world=World.new()
assert(world:apply("C",{22}))
assert(world:apply("D",{{"native",22,"Lua",700,720,0,40,100,35,0}}))
assert(world:localPlayer().x==700 and world:localPlayer().y==720)
assert(world:apply("P",{}))
assert(world.dead and not world.spawned)
assert(world:localPlayer()==nil,"dead player disappears from world")
assert(world.lastDeath.x==700 and world.lastDeath.y==720)
d:start()
assert(d.active and d:fontSize()==0)
assert(not d:update(0.1) and d:fontSize()==10)
assert(not d:update(1.1) and d:fontSize()==120)
assert(not d:update(1.7),"must retain full 3000ms death animation")
assert(d:update(0.1),"return original menu after 3000ms")
assert(d.elapsed==3 and d:fontSize()==120)
if love and love.graphics and love.graphics.newFont then
  -- A real frame must paint the overlay without breaking LÖVE graphics state.
  d:draw(1280,720)
end
d:reset()
assert(not d.active and d.elapsed==0)
assert(world:apply("C",{22}) and world.spawned and not world.dead)
assert(world:localPlayer()==nil)
assert(world:apply("D",{{"native",22,"Lua",920,840,0,100,100,35,0}}))
assert(world:localPlayer().x==920 and world.lastDeath.x==700)
-- The native client must reuse the ORIGINAL M packet on the same
-- still-open authenticated WebSocket after P; never fabricate a new entity.
local Original=require("src.net.original_client")
local simulated=Original.new({http={},name="Lua"})
simulated.session={}
simulated.websocket={state="open"}
simulated.state="spawn_confirmed"
simulated.spawnSent=true
local sent=false
function simulated:send(op,args)
  assert(op=="M" and #args==1 and type(args[1])=="table")
  sent=true
  return true
end
assert(simulated:spawn({name="Lua",skin=2}))
assert(sent and simulated.state=="joining" and simulated.spawnSent)
local Menu=require("src.game.reference_menu")
local menu=Menu.new()
menu.connectionState="spawn_confirmed"
assert(menu:canPlay(),"Play must remain available for actual respawn after P")
print("reference YOU DIED 3s animation, authoritative death and respawn state passed")
