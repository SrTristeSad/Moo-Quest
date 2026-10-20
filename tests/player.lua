package.path="./?.lua;./?/init.lua;"..package.path
local World=require("src.server.world")
local Player=require("src.server.player")
local C=require("src.game.config")
local w=World.new({random=function() return 0.5 end})
local p=Player.new(w)
local x,y=p:spawn()
assert(p.alive and p.health==100 and x>=35 and y>=35)
assert(p:setMoveDir(0))
assert(not p:setMoveDir(0/0))
assert(p:setAim(math.pi))
local oldX=p.x
p:tick(1000/9)
assert(p.x>oldX,"server-authoritative move should advance the player")
assert(p:setMoveDir(nil))
local previous=p.x
p:tick(1000/9)
assert(p.x>=previous,"momentum must decay, not reverse instantly")
local snow=Player.new(w);snow:spawn();snow.x,snow.y=1000,1000;snow.xVel=0;snow.yVel=0
local grass=Player.new(w);grass:spawn();grass.x,grass.y=1000,5000;grass.xVel=0;grass.yVel=0
snow:setMoveDir(0);grass:setMoveDir(0)
snow:tick(100);grass:tick(100)
assert(snow.x-1000<grass.x-1000,"snow movement slowdown")
local c=Player.new(w);c:spawn();c.x,c.y=14360,5000;c:setMoveDir(0);c:tick(1000/9)
assert(c.x<=C.mapScale-c.scale+0.001,"world boundary")
local obj=w:addNatural(1000,5000,80,2,true)
assert(obj~=nil)
local collision=Player.new(w);collision:spawn();collision.x,collision.y=1000,5000
collision:resolveObjectCollision(obj)
local dx=collision.x-obj.x;local dy=collision.y-obj.y
assert(dx*dx+dy*dy>=(collision.scale+obj.scale-0.00001)^2)
print("server-side player movement, snow, boundary and object collision tests passed")
