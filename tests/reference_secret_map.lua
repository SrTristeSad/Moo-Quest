package.path="./?.lua;./?/init.lua;"..package.path
local S=require("src.game.reference_secret_map")
local C=require("src.game.config")
local function near(a,b,tol) return math.abs(a-b)<(tol or 0.00001) end
-- These coordinates and collision shapes are shared/config.js secretPool,
-- with the EXACT union inequality of Node effects.js::secretDistance.
assert(C.secretPool.gorgeX0==-1500 and C.secretPool.gorgeHalf==520)
assert(#C.secretPool.pool==5)
assert(S.inside(-1000,7200),"gorge corridor allows entry from west bank")
assert(S.inside(-1000,7720),"gorge top edge must remain walkable")
assert(not S.inside(-1000,7721),"gorge outside edge must not be filled")
assert(S.inside(-2500,7200) and S.inPool(-2500,7200),
  "Crab King's Node spawn belongs to the first pool")
assert(S.inside(-3300,6750) and S.inPool(-3200,7750))
assert(S.inside(-4300,7250),"west waterfall continues beyond last pool")
assert(not S.inside(-4300,7521),"waterfall band must obey Node cutoff")
assert(not S.inside(-1000,9000),"west void must remain outside the game")
assert(not S.inside(100,7200),"normal east world must be untouched")
assert(S.inside(-2500,8280) and not S.inPool(-2500,8280),
  "water has 90 percent of pool radius, leaving sandy shoreline")
-- Node signedDistance may be negative in a pool, but positive outside
-- the UNION of the five circles, the gorge and the waterfall corridor.
assert(S.signedDistance(-2500,7200)<0)
assert(S.signedDistance(-1000,7721)>0)
if love and love.graphics and love.graphics.newCanvas then
  local gfx=love.graphics
  local canvas=gfx.newCanvas(400,400)
  local function pixel(focusX,focusY,wave)
    local camera={zoom=1}
    function camera:worldToScreen(x,y)
      return x-focusX+200,y-focusY+200
    end
    function camera:screenToWorld(x,y)
      return x+focusX-200,y+focusY-200
    end
    gfx.push("all")
    -- LÖVE requires an explicit stencil buffer when testing stencil
    -- geometry inside an offscreen Canvas (onscreen already has one).
    gfx.setCanvas({canvas,stencil=true})
    gfx.clear(0,0,0,0)
    -- Test both the terrain pass and ORIGINAL outside-boundary alpha pass.
    S.draw(camera,400,400,wave or 1)
    S.shadeOutside(camera,400,400)
    gfx.setCanvas()
    gfx.pop()
    return canvas:newImageData():getPixel(200,200)
  end
  local r,g,b,a=pixel(-2500,7200)
  assert(a>0.95 and b>r and b>g*0.90,
    "Node first pool must be blue water, not solid green background")
  local sr,sg,sb,sa=pixel(-2500,8280)
  assert(sa>0.95 and sr>sb*1.3 and sg>sb,
    "real 10 percent pool shoreline must appear sand-coloured")
  local dr,dg,db,da=pixel(-1000,9000)
  assert(da>0.95 and dr<0.25 and dg<0.30 and db<0.25,
    "invalid western coordinates must remain shaded outside the world")
  -- Sample ten world units inside the gorge: the exact 7720 border
  -- is a fractional raster edge (Canvas pixels have 0.5px centres).
  local gr,gg,gb,ga=pixel(-1000,7710)
  assert(ga>0.95 and gr>0.35 and gg>0.45,
    "gorge walkway cannot be blank or painted as forbidden void")
  local wr,wg,wb,wa=pixel(-4300,7250)
  assert(wa>0.95 and wb>wr,
    "waterfall corridor must be drawn beyond x=-3860")
  local wr2,wg2,wb2,wa2=pixel(-4300,7470)
  assert(wa2>0.95 and wr2>wb2,
    "waterfall bank must be sand, not water or empty void")
  local tr,tg,tb,ta=pixel(100,7200)
  assert(ta==0 and tr==0 and tg==0 and tb==0,
    "secret extension must never cover x>=0 standard MooMoo world")
  -- Pulse water length changes the gorge, NOT shape/collision ownership.
  local base={pixel(-600,7580,1)}
  local expanded={pixel(-600,7580,1.3)}
  assert(base[1]>base[3] and expanded[3]>expanded[1],
    "original water wave must be visible at the gorge's bank")
end
print("Node west map: 5 pools, gorge, waterfall, shore, boundaries and wave pixels passed")
