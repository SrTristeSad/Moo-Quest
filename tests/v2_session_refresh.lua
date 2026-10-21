package.path="./?.lua;./?/init.lua;"..package.path
local Original=require("src.net.original_client")
local access=string.rep("a",64)
local rotated=string.rep("b",64)
local ticket=string.rep("c",36)
local did=string.rep("d",24)
local fakeHttp={TIMEOUT=10,request=function(url)
  assert(url=="http://127.0.0.1:8080/ping")
  return '{"status":"ok","build":"mqv2native"}',200
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
local function options(join,refresh)
  return {
    http=fakeHttp,join=join,socket=fakeSocket,
    nativeSession=true,expectedBuild="mqv2native",
    authToken=access,authRefresh=refresh,
    random=function(n) return string.rep("a",n) end,
    sha1=function() return string.rep("\0",20) end
  }
end
local joinCalls,refreshCalls=0,0
local active=Original.new(options({guest=function(request)
  joinCalls=joinCalls+1
  if joinCalls==1 then
    assert(request.authToken==access)
    return nil,"API V2 HTTP 401: invalid_player_token",401
  end
  assert(request.authToken==rotated)
  return {ticket=ticket,did=did}
end},function()
  refreshCalls=refreshCalls+1
  return {token=rotated,refreshToken=string.rep("e",64)}
end))
assert(active:connect())
assert(active.authToken==rotated)
assert(joinCalls==2 and refreshCalls==1)
assert(active.websocket.path=="/s/LC?b=mqv2native&token=tk:"..ticket)
active:close()

local rejectRefresh=0
local denied=Original.new(options({guest=function()
  return nil,"API V2 HTTP 403: guest_verification_failed",403
end},function()
  rejectRefresh=rejectRefresh+1
  error("refresh must not run for HTTP 403")
end))
assert(not denied:connect())
assert(rejectRefresh==0)
assert(denied.authToken==access)

local retries,failedRefresh=0,0
local expired=Original.new(options({guest=function()
  retries=retries+1
  return nil,"API V2 HTTP 401: invalid_player_token",401
end},function()
  failedRefresh=failedRefresh+1
  return nil,"invalid_refresh_token"
end))
assert(not expired:connect())
assert(retries==1 and failedRefresh==1)
assert(expired.error:find("Sessao V2 expirada",1,true))

local retryCount=0
local noLoop=Original.new(options({guest=function(request)
  retryCount=retryCount+1
  if retryCount==1 then return nil,"expired",401 end
  assert(request.authToken==rotated)
  return nil,"expired again",401
end},function() return {token=rotated} end))
assert(not noLoop:connect())
assert(retryCount==2,"refresh must never recursively retry")

local guestRefresh=0
local guest=Original.new(options({guest=function(request)
  assert(request.authToken==nil)
  return nil,"invalid_player_token",401
end},function() guestRefresh=guestRefresh+1 end))
guest.authToken=nil
assert(not guest:connect())
assert(guestRefresh==0)
assert(fakeHttp.TIMEOUT==10)
print("V2 client session renewal only on authenticated 401 passed")
