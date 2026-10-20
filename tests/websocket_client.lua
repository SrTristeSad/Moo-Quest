package.path="./?.lua;./?/init.lua;"..package.path
local Client=require("src.net.websocket_client")
local accept="s3pPLMBiTxaQ9kYGzzhZRbK+xOo="
local sent={}
local sock={}
local connected=false
function sock:settimeout(n) assert(n==0) end
function sock:connect(host,port)
  assert(host=="127.0.0.1" and port==8080)
  return nil,"timeout"
end
function sock:send(data)
  assert(connected,"sent before TCP was ready")
  sent[#sent+1]=data
  return #data
end
local response="HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: "..accept.."\r\n\r\n"
local reads=0
function sock:receive(n)
  reads=reads+1
  if reads==1 then return nil,"timeout","" end
  if reads==2 then return nil,"timeout",response..string.char(130,2).."Hi" end
  return nil,"timeout",""
end
function sock:close() end
local lib={
  tcp=function() return sock end,
  select=function(_,write,timeout)
    assert(timeout==0 and write[1]==sock)
    if not connected then return {},{} end
    return {},{sock}
  end
}
local c=Client.new({
  socket=lib,
  secureRandom=function(n) return string.rep("a",n) end,
  sha1=function() return string.rep("\0",20) end
})
local ok=c:connect("127.0.0.1",8080,"/s/LC")
assert(ok and c.state=="tcp_connecting")
c:update()
assert(#sent==0,"must not send before TCP connect")
connected=true
c:update()
assert(c.state=="upgrading" and #sent==1)
-- The sample accept belongs to the RFC nonce; override only to test frame handling.
c.expected=accept
c:update()
assert(c.state=="open")
local events=c:drain()
assert(#events==2 and events[1].kind=="open" and events[2].kind=="binary" and events[2].value=="Hi")
assert(c:send("ok"))
c:update()
assert(#sent==2 and sent[2]:byte(1)==130)
c:close()
print("nonblocking websocket transport tests passed")
