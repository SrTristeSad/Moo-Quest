package.path="./?.lua;./?/init.lua;"..package.path
local World=require("src.game.world_state")
local View=require("src.game.reference_view")
local Notices=require("src.game.reference_notices")
local function near(a,b)
  return math.abs(a-b)<0.00001
end
local w=World.new()
assert(w.pongCount==0 and not Notices.status(w))
assert(w:apply("C",{7}))
assert(w:apply("D",{{"local",7,"Diver",140,140,0,100,100,35,0,
  0,0,nil,-1,0,0,0}}))
assert(w:apply("D",{{"remote",8,"Other",200,140,0,100,100,35,0,
  0,0,nil,-1,0,0,0}}))
assert(w.players[7].dive==0 and w.players[8].dive==0)
assert(w:apply("m",{8,1,700}))
assert(w.players[8].dive==1 and w.players[8].diveDuration==700)
assert(w.players[7].dive==0,
  "server dive events must not change unrelated players")
assert(w:apply("m",{8,2,0}) and w.players[8].dive==2)
assert(View.playerOpacity(w.players[8])==0.2)
assert(View.playerOpacity(w.players[7])==1)
assert(w:apply("m",{8,3,800}) and View.playerOpacity(w.players[8])==0.7)
assert(w:apply("m",{8,0,0}) and View.playerOpacity(w.players[8])==1)
assert(w:apply("m",{99,2,0}) and w.players[99]==nil,
  "unseen player dive packet must not spawn a fake entity")
assert(not w:apply("m",{8,5,500}))
assert(not w:apply("m",{8,-1,500}))
assert(not w:apply("m",{8,2,-100}))
assert(not w:apply("m",{"remote",2,100}))
assert(w.players[8].dive==0,"invalid m must not alter player")
-- New D snapshots remain authoritative about initial dive states.
assert(w:apply("D",{{"remote",8,"Other",200,140,0,100,100,35,0,
  0,0,nil,-1,2,0,0}}))
assert(View.playerOpacity(w.players[8])==0.2)
assert(w:apply("m",{8,0,0}))
-- Shutdown / update timestamps are derived exclusively from packets.
assert(w:apply("r",{125}) and Notices.status(w)=="Atualizacao do jogo em 2:05")
w:update(0.5)
assert(near(w.updateSeconds,124.5))
assert(Notices.status(w)=="Atualizacao do jogo em 2:05")
assert(w:apply("r",{0}) and Notices.status(w)=="Atualizacao do jogo apos esta vida")
w:update(50)
assert(w.updateSeconds==0,"update r 0 means after this life, NOT an expiring countdown")
assert(w:apply("Z",{5}) and Notices.status(w)=="Servidor reiniciando em 0:05")
w:update(2)
assert(Notices.status(w)=="Servidor reiniciando em 0:03")
assert(w:apply("Z",{-1}) and w.restartSeconds==nil)
assert(Notices.status(w)=="Atualizacao do jogo apos esta vida",
  "cancelling server restart should keep any independent game update message")
assert(not w:apply("Z",{-2}) and not w:apply("r",{-1}))
assert(not w:apply("r",{"10"}) and not w:apply("Z",{math.huge}))
assert(w.pongCount==0)
assert(w:apply("0",{}) and w:apply("0",{}) and w.pongCount==2,
  "acknowledge only received Node ping replies")
-- Server-announced restart persists into the menu/respawn until cancellation.
assert(w:apply("Z",{15}))
assert(w:apply("C",{7}) and near(w.restartSeconds,15))
assert(Notices.status(w)=="Servidor reiniciando em 0:15")
if love and love.graphics and love.graphics.newCanvas then
  local g=love.graphics
  local canvas=g.newCanvas(360,360)
  local camera={zoom=1,worldToScreen=function(_,x,y) return x,y end}
  w.players={}
  w.sid=7
  local player={sid=7,name="",x=175,y=190,dir=0,scale=35,
    buildIndex=-1,weaponIndex=99,skin=0,tail=0,health=100,maxHealth=100}
  w.players[7]=player
  w.restartSeconds=nil;w.updateSeconds=nil
  local function render(dive)
    player.dive=dive
    g.push("all")
    g.setCanvas(canvas)
    g.clear(0,0,0,0)
    View.draw(w,camera,0,{showGrid=false,localAim=0})
    g.setCanvas()
    g.pop()
    return {canvas:newImageData():getPixel(175,190)}
  end
  local surface=render(0)
  local underwater=render(2)
  assert(math.abs(surface[1]-underwater[1])>0.06
     or math.abs(surface[2]-underwater[2])>0.06
     or math.abs(surface[3]-underwater[3])>0.06,
    "Node m=2 must visibly fade the original rendered player without altering world")
  assert(w:apply("Z",{30}))
  g.push("all")
  g.setCanvas(canvas)
  g.clear(0,0,0,0)
  assert(Notices.draw(w,360,360),"server restart must paint a visible banner")
  g.setCanvas()
  g.pop()
  local _,_,_,alpha=canvas:newImageData():getPixel(180,100)
  assert(alpha>0.2,"notice must actually render, not just store a string")
end
print("server Node m/r/Z/0: dive stages, announcements, expiry and LÖVE pixels verified")
