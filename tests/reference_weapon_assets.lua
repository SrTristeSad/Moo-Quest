package.path="./?.lua;./?/init.lua;"..package.path
local Assets=require("src.game.reference_assets")
local C=require("src.game.catalog")
local available={
  ["bow_1.png"]=true,["bow_1_g.png"]=true,
  ["bow_1_r.png"]=true,["bow_1_e.png"]=true,
  ["sword_1_d.png"]=true
}
local function exists(path) return available[path] or false end
local name,missing=Assets.weaponFilename("bow_1","_d",exists)
assert(name=="bow_1.png" and missing,
  "diamond bow original PNG absent: must remain visible using base bow")
name,missing=Assets.weaponFilename("bow_1","_g",exists)
assert(name=="bow_1_g.png" and not missing,
  "original gold bow art must not be replaced")
name,missing=Assets.weaponFilename("sword_1","_d",exists)
assert(name=="sword_1_d.png" and not missing,
  "valid variant art must always win")
name,missing=Assets.weaponFilename("bow_1","",exists)
assert(name=="bow_1.png" and not missing)
assert(Assets.weaponFilename("../secrets","_e",exists)==nil)
assert(Assets.weaponFilename("bow_1","_bad",exists)==nil)
assert(#C.weapons==16,"preserve all 16 original weapon definitions")
if love and love.graphics and love.graphics.newImage then
  local png=love.filesystem.getInfo("assets/reference/img/weapons/bow_1.png","file")
  if png then
    local real=Assets.get("weapons","bow_1.png")
    assert(real,"base bow must be decodable when local reference art is installed")
  end
end
print("missing diamond bow variant uses original base art; available weapon variants stay exact")
