package.path="./?.lua;./?/init.lua;"..package.path
local O=require("src.net.original_client")
local fakeHttp={TIMEOUT=10,request=function(url)
  assert(url=="http://127.0.0.1:8080/ping")
  return '{"status":"ok","build":"abc123def","servers":[]}',200
end}
local fakeSocket={
  tcp=function() return {
    settimeout=function() end,
    connect=function() return true end,
    send=function(_,data) return #data end,
    receive=function() return nil,"timeout","" end,
    close=function() end
  }end,
  select=function() return {},{} end
}
local c=O.new({
  http=fakeHttp,socket=fakeSocket,random=function(n) return string.rep("a",n) end,
  sha1=function() return string.rep("\0",20) end
})
assert(c:connect() and c.build=="abc123def")
assert(c.state=="connecting")
assert(c.websocket.path=="/s/LC?b=abc123def")
assert(c.http.TIMEOUT==10)
c:close()
local missing=O.new({http={request=function() return nil,"connection refused" end},
  socket=fakeSocket,random=function(n) return string.rep("a",n) end,
  sha1=function() return string.rep("\0",20) end})
assert(not missing:connect())
assert(missing.state=="failed")
print("direct original WebSocket initialization tests passed")
