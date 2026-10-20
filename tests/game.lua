package.path="./?.lua;./?/init.lua;"..package.path
local Game=require("src.server.game")
local World=require("src.server.world")
local M=require("src.protocol.msgpack")
local w=World.new({random=function() return 0.5 end})
local obj=w:addNatural(1000,1000,90,2,true)
assert(obj)
local g=Game.new({world=w,generate=false})
local player,packets=g:join("local","Tester")
assert(player.sid==0 and #packets==5)
local raw=M.encode(g:worldPacket())
local parsed=M.decode(raw)
assert(parsed[1]=="world" and parsed[5][1][5]==2)
assert(packets[5][1]=="animals" and #packets[5][2]>0)
local start=player.x
g:command("local",{"move",0})
g:tick(1000/9)
assert(player.x>start)
g:command("local",{"move",M.null})
assert(player.moveDir==nil)
player.x,player.y=855,1000
player.xVel,player.yVel=0,0
player.dir=0
local before=player.stone
local replies=g:command("local",{"attack"})
assert(replies[1][1]=="gather" and replies[1][2]==1)
assert(player.stone==before+1)
local second=g:command("local",{"attack"})
assert(#second==0,"hammer cooldown enforced")
player.x,player.y=4000,4000
player.dir=0
local built=g:command("local",{"build",0})
assert(built[1][1]=="object" and built[1][7]==3)
assert(#w.objects==2)
assert(w.objects[2].health==380 and w.objects[2].owner==0)
local blocked=g:command("local",{"build",0})
assert(blocked[1][1]=="error")
assert(g:playerPacket()[2][1][1]==0)
local anotherAnimal=g.animals.list[1]
assert(anotherAnimal and anotherAnimal.health>0)
local beforeHealth=anotherAnimal.health
player.x,player.y=anotherAnimal.x-80,anotherAnimal.y
player.xVel,player.yVel=0,0
player.dir=0
-- Allow the attack cooldown to expire before attacking a real animal.
g.elapsed=g.elapsed+500
local attackResult=g:command("local",{"attack"})
assert(attackResult[1][1]=="gather")
assert(anotherAnimal.health<beforeHealth or anotherAnimal.spawnCounter>0,"animal should take real server-side damage")
player.health=0;player.alive=false
local respawn=g:command("local",{"respawn"})
assert(respawn[1][1]=="respawned" and player.alive and player.health==100)
g:leave("local")
assert(next(g.players)==nil)
print("Lua game engine join, movement, gathering, wall and state tests passed")
