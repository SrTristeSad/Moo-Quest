package.path="./?.lua;./?/init.lua;"..package.path
local World=require("src.game.world_state")
local View=require("src.game.reference_view")
local Shapes=require("src.game.reference_primitives")
local Assets=require("src.game.reference_assets")
local Catalog=require("src.game.catalog")
-- The JS reference does not cull players/AI by center; a wing, hat,
-- weapon, name or large boss may cross the viewport while its center is
-- outside. This is easy to miss with normal-sized bodies at screen edges.
assert(Catalog.accessories[1] and Catalog.hats[1])
if love and love.graphics and love.graphics.newCanvas then
  local g=love.graphics
  local width,height=g.getDimensions()
  local screen=g.newCanvas(width,height)
  local cam={zoom=1}
  function cam:worldToScreen(x,y) return x,y end
  function cam:screenToWorld(x,y) return x,y end
  local w=World.new()
  w.sid=1
  local p={sid=1,name="",x=width+55,y=height/2,scale=35,
    buildIndex=-1,weaponIndex=0,variant=0,tail=18,skin=0,
    skinColor=0,health=0,maxHealth=100,dir=0,zIndex=0}
  w.players[1]=p
  local function draw(world)
    g.push("all")
    g.setCanvas(screen)
    g.clear(0,0,0,0)
    View.draw(world,cam,0,{showGrid=false,localAim=0})
    g.setCanvas()
    g.pop()
    return screen:newImageData()
  end
  local base=draw(World.new())
  local seen={}
  local original=Assets.draw
  Assets.draw=function(category,filename,...)
    seen[#seen+1]=category.."/"..filename
    return original(category,filename,...)
  end
  local withWings=draw(w)
  Assets.draw=original
  assert(table.concat(seen,";"):find("accessories/access_18.png",1,true),
    "wings must still be submitted for drawing when center is beyond viewport")
  -- Pixel test uses ONLY the user's original imported reference PNG,
  -- without inventing artwork if it has not been imported yet.
  if Assets.get("accessories","access_18.png") then
    local different=false
    for y=math.max(1,math.floor(height/2-85)),
      math.min(height-2,math.floor(height/2+85)),4 do
      for x=math.max(1,width-78),width-2,3 do
        local a,b,c=base:getPixel(x,y)
        local d,e,f=withWings:getPixel(x,y)
        if math.abs(a-d)+math.abs(b-e)+math.abs(c-f)>0.06 then
          different=true
          break
        end
      end
      if different then break end
    end
    assert(different,
      "the ORIGINAL Blood Wings pixels must remain visible beyond body center")
  end
  -- Test sprite layering and spinning equipment at full resolution.
  p.x=width/2
  p.skin=14  -- original Windmill Hat has a topSprite
  p.tail=16  -- original Sawblade has spin=true
  p.skinRot=1.25
  local trace={}
  local circle=Shapes.circle
  Shapes.circle=function(x,y,r,...)
    if r==14 then trace[#trace+1]={kind="hand"} end
    if r==35 then trace[#trace+1]={kind="body"} end
    return circle(x,y,r,...)
  end
  Assets.draw=function(category,filename,x,y,ww,hh,rotation,alpha)
    if category=="weapons" or category=="hats" or
      category=="accessories" then
      trace[#trace+1]={kind=category,file=filename,rotation=rotation or 0}
    end
    return original(category,filename,x,y,ww,hh,rotation,alpha)
  end
  local function index(kind,file)
    for i,v in ipairs(trace) do
      if v.kind==kind and (not file or v.file==file) then return i end
    end
  end
  -- Ordinary hammer belongs BEHIND hands, body & hat.
  p.weaponIndex=0
  draw(w)
  local saw=index("accessories","access_16.png")
  local hammer=index("weapons","hammer_1.png")
  local hand=index("hand")
  local body=index("body")
  local hat=index("hats","hat_14.png")
  local top=index("hats","hat_14_top.png")
  assert(saw and hammer and hand and body and hat and top)
  assert(saw<hammer and hammer<hand and hand<body and body<hat and hat<top,
    "MooMoo renderPlayer layering: spinning tail, weapon, hands, body, hat, top")
  assert(math.abs(trace[saw].rotation-1.25)<0.00001)
  assert(math.abs(trace[top].rotation-1.25)<0.00001,
    "topSprite and spinning tail must keep original independent skinRot")
  -- Above-hand crossbow must be above both hands but BEHIND body/hat.
  trace={}
  p.weaponIndex=12
  draw(w)
  hand=index("hand")
  local crossbow=index("weapons","crossbow_1.png")
  body=index("body")
  assert(hand and crossbow and body and hand<crossbow and crossbow<body,
    "original aboveHand crossbow cannot appear behind the hands")
  -- A player on an original platform (zIndex=1) still draws cosmetics.
  trace={}
  p.zIndex=1
  draw(w)
  assert(index("accessories","access_16.png") and
    index("hats","hat_14_top.png"),
    "zIndex=1 must preserve all cosmetics, not just body silhouette")
  -- Invisible entities really sent as hidden by Node stay invisible.
  trace={}
  p.invisible=1
  draw(w)
  assert(not index("accessories") and not index("body"),
    "Node invisible flag must remain respected")
  Assets.draw=original
  Shapes.circle=circle
end
print("reference cosmetics at viewport edges, spinning sprites, player layers and invisibility passed")
