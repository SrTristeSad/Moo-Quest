package.path="./?.lua;./?/init.lua;"..package.path
local O=require("src.net.original_client")
local ticket=string.rep("a",36)
local n=0
local fakeJoin={guest=function(args)
  assert(args.host=="127.0.0.1" and args.port==8080 and args.server=="LC")
  n=n+1
  return {ticket=ticket,did=string.rep("b",24)}
end}
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
  } end,
  select=function() return {},{} end
}
local function fakeOpts()
  return {http=fakeHttp,join=fakeJoin,socket=fakeSocket,
    random=function(nbytes) return string.rep("a",nbytes) end,
    sha1=function() return string.rep("\0",20) end}
end
local c=O.new(fakeOpts())
assert(c:connect() and c.build=="abc123def")
assert(c.state=="connecting")
assert(c.websocket.path=="/s/LC?b=abc123def&token=tk:"..ticket)
assert(c.http.TIMEOUT==10 and n==1)
assert(c.status:find("Ticket guest original emitido",1,true))
assert(not c.status:find(ticket,1,true),"do not log token")
c:close()
assert(c:connect() and n==2,"fresh ticket on reconnect")
c:close()
local missing=O.new({http={request=function() return nil,"connection refused" end},
  join=fakeJoin,socket=fakeSocket,
  random=function(nbytes) return string.rep("a",nbytes) end,
  sha1=function() return string.rep("\0",20) end})
assert(not missing:connect() and missing.state=="failed")
local refuseOpts=fakeOpts()
refuseOpts.join={guest=function() return nil,"HTTP 403: captcha" end}
local refused=O.new(refuseOpts)
assert(not refused:connect() and refused.state=="failed")
assert(refused.status:find("captcha",1,true))
local deferredOpts=fakeOpts()
deferredOpts.autoSpawn=false
local deferred=O.new(deferredOpts)
assert(deferred.autoSpawn==false)
assert(deferred:connect() and not deferred.spawnSent)
local early,why=deferred:spawn({name="Lua",skin=0})
assert(not early and type(why)=="string", "cannot send M until authenticated")
deferred:close()
print("direct original WebSocket guest ticket integration tests passed")
