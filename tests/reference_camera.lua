package.path="./?.lua;./?/init.lua;"..package.path
-- Camera scaling follows client/src/index.js resize() 1920x1080 cover mode.
local C=require("src.camera")
local oldLove=love
love={graphics={getDimensions=function() return 1280,720 end}}
local camera=C.new()
assert(math.abs(camera.zoom-2/3)<0.00001)
camera:follow(7200,7200)
local cx,cy=camera:worldToScreen(7200,7200)
assert(cx==640 and cy==360)
local rx,ry=camera:screenToWorld(cx,cy)
assert(rx==7200 and ry==7200)
camera:resize(1920,1080)
assert(camera.zoom==1)
camera:resize(1440,900)
assert(math.abs(camera.zoom-5/6)<0.00001)
camera:resize(1920,720)
assert(camera.zoom==1)
camera:resize(800,800)
assert(math.abs(camera.zoom-800/1080)<0.00001)
camera:follow(100,100)
camera:followReference(200,100,0.05)
assert(math.abs(camera.x-150)<0.00001 and camera.y==100)
love=oldLove
print("reference 1920x1080 cover scale and camera smoothing passed")
