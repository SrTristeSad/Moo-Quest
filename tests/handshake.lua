package.path="./?.lua;./?/init.lua;"..package.path
local H=require("src.protocol.handshake")
local function valid()
  return {"io-init",{"0123456789abcdef",12345,"0123456789abcdef0123456789abcdef",1,1,0}}
end
local parsed,err=H.parse(valid())
assert(parsed and not err and parsed.seed==12345 and parsed.pinned)
local bad=valid();bad[2][4]=9
assert(H.parse(bad)==nil)
bad=valid();bad[2][3]="invalid"
assert(H.parse(bad)==nil)
assert(H.parse({"bad",{}})==nil)
print("handshake schema tests passed")
