package.path="./?.lua;./?/init.lua;"..package.path
local C=require("src.game.config")
local World=require("src.server.world")
assert(C.mapScale==14400 and C.areaCount==7 and C.riverWidth==724)
assert(#C.server.animalSpawnPlan==13)
local seed=918273
local function random()
  seed=(seed*48271)%2147483647
  return seed/2147483647
end
local world=World.new({random=random})
local objects=world:generate()
assert(#objects>0,"world should contain resources")
local counts=world:countByType()
assert(counts[0]<=C.areaCount*C.areaCount*C.treesPerArea)
assert(counts[1]<=C.areaCount*C.areaCount*C.bushesPerArea)
assert(counts[2]<=C.totalRocks)
assert(counts[3]<=C.goldOres)
assert(counts[0]>0 and counts[1]>0 and counts[2]>0 and counts[3]>0)
local riverTop=C.mapScale/2-C.riverWidth/2
local riverBottom=C.mapScale/2+C.riverWidth/2
for i,o in ipairs(objects) do
  assert(o.sid==i-1,"sequential object IDs")
  assert(o.active and o.scale>0 and o.x>=0 and o.y>=0)
  if o.type==0 then
    assert(o.y<C.mapScale-C.snowBiomeTop,"trees not placed in snow band")
    assert(o.y<riverTop-100 or o.y>riverBottom+100)
  elseif o.type==1 then
    assert(o.y<riverTop-50 or o.y>riverBottom+50)
  end
  for j=1,i-1 do
    local other=objects[j]
    local dx,dy=o.x-other.x,o.y-other.y
    local multiplier=other.type==0 or other.type==1
    local blocker=multiplier and other.scale*0.36 or other.scale
    assert(dx*dx+dy*dy>=(o.scale+blocker)^2,"overlapping generated objects")
  end
end
local w2=World.new({random=function() return 0.5 end})
assert(w2:addNatural(7200,7200,90,0,false)==nil,"tree must not spawn in river")
assert(w2:addNatural(7200,7200,90,2,true),"rock may spawn in river")
assert(w2:addNatural(7200,7200,90,3,true)==nil,"overlap must be refused")
print(string.format("world tests passed (%d trees, %d bushes, %d rocks, %d gold)",counts[0],counts[1],counts[2],counts[3]))
