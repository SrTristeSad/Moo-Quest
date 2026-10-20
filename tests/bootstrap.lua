package.path="./?.lua;./?/init.lua;"..package.path
local M=require("src.protocol.msgpack")
local B=require("src.protocol.bootstrap")
local frame={"io-init",{"0123456789abcdef",12345,"0123456789abcdef0123456789abcdef",1,1,0}}
local data=M.encode(frame)
local parsed,err=B.decodeHandshake(data)
assert(parsed and not err and parsed.socketId=="0123456789abcdef")
assert(B.decodeHandshake("garbage")==nil)
print("bootstrap decoder tests passed")
