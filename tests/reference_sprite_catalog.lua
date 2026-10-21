-- Validate the actual 180 archived pixels in LÖVE, not only PNG signatures.
-- No third-party art is tracked by git: CI imports it into its temporary runner.
package.path="./?.lua;./?/init.lua;"..package.path
local Catalog=require("src.game.catalog")
local Store=require("src.game.store_catalog")
local Animals=require("src.game.animals")
local Json=require("src.net.json")
local Assets=require("src.game.reference_assets")
local Icons=require("src.game.reference_icons")
local Objects=require("src.game.reference_objects")
local raw
if love and love.filesystem then
  raw=assert(love.filesystem.read("support/reference-image-manifest.json"))
else
  local fd=assert(io.open("support/reference-image-manifest.json","rb"))
  raw=fd:read("*a")
  fd:close()
end
local manifest=assert(Json.decode(raw))
local allowed={}
local files=0
for category,names in pairs(manifest) do
  assert(type(names)=="table")
  allowed[category]={}
  for _,name in ipairs(names) do
    assert(type(name)=="string" and name:match("^[%w_-]+%.png$"))
    assert(not allowed[category][name],"duplicate sprite "..category.."/"..name)
    allowed[category][name]=true
    files=files+1
  end
end
assert(files==180,"expected all 180 upstream sprite names")
local function listed(category,name)
  assert(allowed[category] and allowed[category][name],
    "missing reference art in manifest: "..category.."/"..name)
end
for _,weapon in ipairs(Catalog.weapons) do
  listed("weapons",weapon.src..".png")
end
for _,animal in ipairs(Animals.types) do
  listed("animals",animal.src..".png")
end
for _,hat in ipairs(Catalog.hats) do
  listed("hats","hat_"..hat.id..".png")
  if hat.topSprite then
    listed("hats","hat_"..hat.id.."_p.png")
    listed("hats","hat_"..hat.id.."_top.png")
  end
end
for _,accessory in ipairs(Catalog.accessories) do
  listed("accessories","access_"..accessory.id..".png")
end
for _,name in ipairs({"food_ico.png","gold_ico.png","stone_ico.png","wood_ico.png"}) do
  listed("resources",name)
end
listed("icons","crown.png")
listed("icons","skull.png")
-- The Lua-only unit test validates the names; true graphics need the real
-- downloaded archive and a live OpenGL LÖVE context.
if not (love and love.graphics) or
    os.getenv("MOOQUEST_VERIFY_ART")~="1" then
  print("reference sprite manifest mappings passed (runtime check not requested)")
  return
end

Assets.reset()
local gfx=love.graphics
local canvas=gfx.newCanvas(160,160)
local tested=0
local function capture(label,draw)
  gfx.push("all")
  gfx.setCanvas(canvas)
  gfx.clear(0,0,0,0)
  local success=draw()
  gfx.setCanvas()
  gfx.pop()
  assert(success,label.." failed to draw with real LÖVE")
  tested=tested+1
end
for category,names in pairs(manifest) do
  for _,name in ipairs(names) do
    local filename="assets/reference/img/"..category.."/"..name
    assert(love.filesystem.getInfo(filename,"file"),"missing "..filename)
    local image=Assets.get(category,name)
    assert(image and image:typeOf("Image"),"bad PNG at runtime: "..filename)
    assert(image:getWidth()>0 and image:getHeight()>0,
      "zero-size image: "..filename)
    capture(filename,function()
      return Assets.draw(category,name,80,80,60,60)
    end)
  end
end
for _,weapon in ipairs(Catalog.weapons) do
  capture("weapon icon "..weapon.id,function()
    return Icons.draw("weapon",weapon,80,80,66)
  end)
end
for _,item in ipairs(Catalog.items) do
  assert(Objects.sprite({id=item.id,scale=item.scale},true),
    "item Canvas missing: "..item.name)
  capture("item icon "..item.id,function()
    return Icons.draw("item",item,80,80,66)
  end)
end
local pending,count=Assets.missingSummary(5)
assert(count==0,"reference asset loader reported "..count..
  " missing PNG(s): "..table.concat(pending,", "))
assert(tested==180+#Catalog.weapons+#Catalog.items,
  "art test did not render the entire sprite/icon catalog")
print(("reference art loaded and drawn inside LÖVE: %d original images, %d weapon icons, %d item icons"):format(
  files,#Catalog.weapons,#Catalog.items))
