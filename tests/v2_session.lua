package.path="./?.lua;./?/init.lua;"..package.path
local T=require("src.protocol.v2_session")
local MP=require("src.protocol.msgpack")
local h={mode=1,pinned=false,sealMode=0,rawKeyHex=string.rep("ab",16),seed=12345}
local inner="838103b0e63e60dfd9636c8d68652879dbcd2b214104e4b35072adc8a0bb8eba"
local final="7b9bd90e6f2efc668cf2d924e8d78ae8e12391d93060c898d73ef40dc9dde88a"
local function unhex(s)return s:gsub("..",function(b)return string.char(tonumber(b,16))end)end
local digests=0
local function sha256(content)
  digests=digests+1
  if digests==1 then
    assert(#content==68)
    assert(content:sub(-4)==string.char(0x93,7,0x90,1))
    assert(content:byte(1)==(0xab==0xab and 0x9d))
    return unhex(inner)
  end
  assert(digests==2 and #content==96)
  assert(content:byte(1)==0xf7)
  assert(content:sub(-32)==unhex(inner))
  return unhex(final)
end
local instance=assert(T.new(h,nil,sha256))
assert(instance.tables.c2s.enc.M==7)
assert(instance.tables.c2s.enc["0"]==1)
assert(instance.tables.c2s.enc.F==0)
assert(instance.tables.s2c.enc.C==4)
assert(instance.tables.s2c.enc["5"]==9)
assert(instance.tables.s2c.enc.A==7)
local packet=assert(instance:encode("M",{}))
local bytes={}
for i=1,#packet do bytes[#bytes+1]=string.format("%02x",packet:byte(i)) end
assert(table.concat(bytes)=="7b9bd90e6f2e93079001","exact Node V2 HMAC+MessagePack frame")
assert(instance.sent==1)
assert(not instance:encode("q",{}))
local decoded=assert(instance:decode(MP.encode({4,{12}})))
assert(decoded.name=="C" and decoded.args[1]==12)
assert(not instance:decode(MP.encode({199,{}})))
assert(not T.new({mode=1,pinned=true,sealMode=0,rawKeyHex=h.rawKeyHex,seed=1},nil,sha256))
assert(not T.new({mode=1,pinned=false,sealMode=2,rawKeyHex=h.rawKeyHex,seed=1},nil,sha256))
local count=0
local function fake() count=count+1 return string.rep("z",32) end
local other=assert(T.new({mode=1,pinned=false,sealMode=0,
  rawKeyHex=string.rep("ab",16),seed=777},nil,fake))
assert(other.tables.c2s.enc.M==0 and other.tables.c2s.enc["9"]==9)
assert(other.tables.s2c.enc.C==10 and other.tables.s2c.enc.P==6)
print("Independent Lua/Node V2 wire IDs and exact HMAC frame vectors passed")
