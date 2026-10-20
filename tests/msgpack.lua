package.path="./?.lua;./?/init.lua;"..package.path
local M=require("src.protocol.msgpack")
local values={0,127,128,255,256,65535,65536,4294967295,-1,-32,-33,-128,-129,-32768,-32769,-2147483648,true,false,"","hello",string.rep("x",256)}
for _,v in ipairs(values) do
  assert(M.decode(M.encode(v))==v,"roundtrip failed: "..tostring(v))
end
local a={"io-init",{"0123456789abcdef",12345,"0123456789abcdef0123456789abcdef",1,1,0}}
local b=M.decode(M.encode(a))
assert(b[1]=="io-init" and b[2][2]==12345)
local ok=pcall(function() M.decode(string.char(0xda,0,10).."short") end)
assert(not ok)
print("msgpack bootstrap codec tests passed")
