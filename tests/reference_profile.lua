package.path="./?.lua;./?/init.lua;"..package.path
local World=require("src.game.world_state")
local Profile=require("src.game.reference_profile")
local HUD=require("src.game.reference_hud")
local world=World.new()
assert(world:apply("C",{42}))
assert(world:apply("D",{{"owner",42,"User",400,400,0,100,100,35,0}}))
-- The player card is accessible from existing, real Node G leaderboard rows.
assert(world:apply("G",{{42,"User",950,7,"Anon#7",300}}))
assert(HUD.leaderboardHitTest(world,1280,1030,27)==42)
assert(HUD.leaderboardHitTest(world,1280,1040,52)==7)
assert(HUD.leaderboardHitTest(world,1280,1040,76)==7)
assert(HUD.leaderboardHitTest(world,1280,1040,77)==nil)
assert(HUD.leaderboardHitTest(world,1280,800,30)==nil)
assert(HUD.leaderboardHitTest(world,1280,1100,20)==nil)
local ui=Profile.new()
assert(not ui:isOpen() and not ui:click(640,360,1280,720))
assert(not ui:open(-1) and not ui:open("42"))
assert(ui:open(42) and ui:isOpen())
-- No client-side optimistic stats are fabricated on profile request.
assert(world.profiles[42]==nil and world.lifeStats[42]==nil)
-- Node 'p' uses JSON string and server-authoritative privacy rules.
local valid='{"name":"User","guest":false,"role":"user","clan":{"name":"Moon"},'..
  '"kills":42,"deaths":4,"bestScore":1500,"lives":13,"playtime":3600}'
assert(world:apply("p",{42,valid}))
assert(world.profiles[42].name=="User")
assert(world.profiles[42].clan=="Moon")
assert(world.profiles[42].kills==42 and world.profiles[42].bestScore==1500)
-- Node 'F' is flat: sid,kills,wood,food,stone,gold,damage,
-- animalDamage,healing,animals,bosses,guestId,score.
assert(world:apply("F",{42,3,40,50,60,70,80,90,100,11,2,nil,555}))
local stats=world.lifeStats[42]
assert(stats.kills==3 and stats.wood==40 and stats.food==50)
assert(stats.stone==60 and stats.gold==70 and stats.damage==80)
assert(stats.animalDamage==90 and stats.healing==100)
assert(stats.animals==11 and stats.bosses==2 and stats.score==555)
assert(stats.guestId==nil,"staff guest IDs must not leak into public UI")
-- Privacy: anonymous and guest profiles have no invented account totals.
assert(world:apply("p",{7,'{"name":"Anon#7","anon":true,"guest":true}'}))
assert(world.profiles[7].anon and world.profiles[7].guest)
assert(world.profiles[7].kills==nil and world.profiles[7].clan==nil)
assert(world:apply("F",{7,0,0,0,0,0,0,0,0,0,0,nil,0}))
assert(world.lifeStats[7].score==0)
-- Reject malformed, overlong and attacker-controlled frames with no state mutation.
assert(not world:apply("p",{42,"not-json"}))
assert(not world:apply("p",{42,'{"name":99}'}))
assert(not world:apply("p",{42,string.rep("x",32769)}))
assert(not world:apply("F",{42,3,40,50,60,70,80,90,100,11,2,nil,0/0}))
assert(not world:apply("F",{42,-1,40,50,60,70,80,90,100,11,2,nil,555}))
assert(world.profiles[42].name=="User" and world.lifeStats[42].score==555)
local bx,by,bw,bh=ui:geometry(1280,720)
assert(bw==498 and bh==478)
local consumed,closed=ui:click(bx+80,by+80,1280,720)
assert(consumed and not closed and ui.sid==42)
consumed,closed=ui:click(bx+bw-20,by+23,1280,720)
assert(consumed and closed and not ui:isOpen())
assert(ui:open(7))
consumed,closed=ui:click(0,0,1280,720)
assert(consumed and closed and not ui:isOpen())
-- Reset the old match: stats from old Node SIDs must not appear on respawn.
assert(world:apply("C",{42}))
assert(world.profiles[42]==nil and world.lifeStats[7]==nil)
if love and love.graphics and love.graphics.newCanvas then
  local g=love.graphics
  local canvas=g.newCanvas(1280,720)
  assert(ui:open(42))
  g.push("all")
  g.setCanvas(canvas)
  g.clear(0,0,0,0)
  assert(ui:draw(world))
  g.setCanvas()
  g.pop()
  local r,green,blue,alpha=canvas:newImageData():getPixel(640,360)
  assert(alpha>0.5 and r>0.04 and green>0.04,
    "profile popup must render an actual panel even while waiting for Node")
end
print("Original Node p/F profile and live stats, privacy, leaderboard and UI passed")
