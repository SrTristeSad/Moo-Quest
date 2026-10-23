-- Runtime audit of the PNG files shipped with the Windows client.
-- Unlike a filename-only manifest test, this asks the actual LÖVE graphics
-- loader to decode every bundled sprite under a headless OpenGL context.
if not love or not love.filesystem or not love.graphics
  or os.getenv("MOOQUEST_VERIFY_BUNDLED_ART")~="1" then
  print("bundled PNG runtime audit not requested")
  return
end

local Json=require("src.net.json")
local Assets=require("src.game.reference_assets")
local manifest=assert(Json.decode(assert(love.filesystem.read(
  "support/reference-image-manifest.json"))))
local checked,absent={},{}
Assets.reset()
for category,names in pairs(manifest) do
  for _,name in ipairs(names) do
    local path="assets/custom/img/"..category.."/"..name
    if love.filesystem.getInfo(path,"file") then
      local image=Assets.get(category,name)
      assert(image and image:typeOf("Image") and
        image:getWidth()>0 and image:getHeight()>0,
        "bundled file is not a decodable PNG: "..path)
      checked[#checked+1]=path
    else
      absent[#absent+1]=category.."/"..name
    end
  end
end
-- Favicon and promotion banner are bundled art but not game entity sprites.
for _,relative in ipairs({"favicon.png","promotion/banner_4.png"}) do
  local path="assets/custom/img/"..relative
  assert(love.filesystem.getInfo(path,"file"),"missing bundled file: "..path)
  local image=love.graphics.newImage(path)
  assert(image:getWidth()>0 and image:getHeight()>0,
    "corrupt extra PNG: "..path)
  checked[#checked+1]=path
end
table.sort(absent)
local expected={"animals/boar_1.png","animals/crab_1.png",
  "animals/yeti_1.png","hats/hat_59.png","hats/hat_60.png",
  "hats/hat_61.png"}
table.sort(expected)
assert(#absent==#expected,
  ("unexpected count of missing catalog PNGs: %d"):format(#absent))
for i,name in ipairs(expected) do
  assert(absent[i]==name,
    "unexpected missing catalog PNG: "..tostring(absent[i]))
end
assert(#checked==176,"expected 176 genuinely decoded bundled PNGs, found "..#checked)
assert(#Assets.missing()==0,"a present bundled PNG could not be decoded")
print("PASS: 176 bundled PNG files decoded by LÖVE; 6 external sprites not included")
