package.path="./?.lua;./?/init.lua;"..package.path
local U=require("src.net.upgrade")
assert(U.base64("hello")=="aGVsbG8=")
assert(U.base64("")=="")
assert(U.base64("f")=="Zg==")
assert(U.base64("fo")=="Zm8=")
local key="dGhlIHNhbXBsZSBub25jZQ=="
local request=U.request("127.0.0.1",8080,"/s/LC",key)
assert(request:find("GET /s/LC HTTP/1.1",1,true))
assert(request:find("Origin: http://127.0.0.1:8080",1,true))
local accept="s3pPLMBiTxaQ9kYGzzhZRbK+xOo="
local response="HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: "..accept.."\r\n\r\n"
assert(U.validateResponse(response,accept))
assert(not U.validateResponse(response,"incorrect"))
assert(not U.validateResponse("HTTP/1.1 403 Forbidden\r\n\r\n",accept))
local _,why403=U.validateResponse("HTTP/1.1 403 Forbidden\r\n\r\n",accept)
local _,why404=U.validateResponse("HTTP/1.1 404 Not Found\r\n\r\n",accept)
local _,why502=U.validateResponse("HTTP/1.1 502 Bad Gateway\r\n\r\n",accept)
assert(why403:find("/s/LC",1,true))
assert(why404:find("rota /s/LC",1,true))
assert(why502:find("proxy",1,true))
assert(not why403:find("token=",1,true))
print("websocket upgrade tests passed")
