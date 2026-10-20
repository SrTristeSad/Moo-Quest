package.path="./?.lua;./?/init.lua;"..package.path
local M=require("src.protocol.msgpack")
local function equal(a,b)
  if a~=a and b~=b then return true end
  return a==b
end
for _,v in ipairs({0.25,-1.75,3.141592653589793,-0.0,1.5,12345.125,math.huge,-math.huge,2^-1074,2^-1022,2^1023}) do
  local decoded=M.decode(M.encode(v))
  assert(equal(v,decoded),"float64 roundtrip failure for "..tostring(v))
end
local spawn={"M",{M.map({name="Player",moofoll=false,skin=2,anon=false})},1}
local roundtrip=M.decode(M.encode(spawn))
assert(roundtrip[1]=="M" and roundtrip[3]==1)
assert(roundtrip[2][1].name=="Player" and roundtrip[2][1].skin==2)
assert(roundtrip[2][1].moofoll==false and roundtrip[2][1].anon==false)
local move={"9",{0.7853981633974483},2}
local decoded=M.decode(M.encode(move))
assert(decoded[2][1]==move[2][1],"direction angle lost precision")
local nilArray=M.decode(M.encode({1,M.null,3}))
assert(nilArray[1]==1 and nilArray[2]==M.null and nilArray[3]==3)
local emptyMap=M.decode(M.encode(M.map({})))
assert(next(emptyMap)==nil)
local largeMap={}
for i=1,20 do largeMap["key"..i]=i end
local round=M.decode(M.encode(largeMap))
assert(round.key1==1 and round.key20==20)
local ok=pcall(function() M.decode(string.char(0xde,0,1,0xc0,0x01)) end)
assert(not ok,"reject nil keys")
print("extended msgpack tests passed")
