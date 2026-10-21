package.path="./?.lua;./?/init.lua;"..package.path
local Auth=require("src.net.local_auth")
local Join=require("src.net.original_join")
local flow=string.rep("a",24)
local token="eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhIn0.S1gn4tur3"
local body,route
local ltn12={
  source={string=function(s)
    local sent=false
    return function()if sent then return nil end;sent=true;return s end
  end},
  sink={table=function(tbl)
    return function(chunk) if chunk then tbl[#tbl+1]=chunk end;return 1 end
  end}
}
local http={
  TIMEOUT=13,
  request=function(opts)
    route=opts.url
    local chunks={}
    while true do
      local v=opts.source()
      if not v then break end
      chunks[#chunks+1]=v
    end
    body=table.concat(chunks)
    assert(opts.headers["Content-Type"]=="application/json")
    assert(tonumber(opts.headers["Content-Length"])==#body)
    if route:sub(-10)=="/auth/code" then
      assert(body:find('"email":"player@example.com"',1,true))
      opts.sink('{"flow":"'..flow..'"}')
    elseif route:sub(-12)=="/auth/verify" then
      assert(body:find('"flow":"'..flow..'"',1,true))
      assert(body:find('"code":"123456"',1,true))
      opts.sink('{"token":"'..token..'","email":"player@example.com","id":"abcdef012345abcdef012345"}')
    elseif route:sub(-7)=="account" then
      assert(body:find('"auth":"'..token..'"',1,true))
      opts.sink('{"name":"Original Name"}')
    elseif route:sub(-4)=="join" then
      assert(body:find('"auth":"'..token..'"',1,true))
      opts.sink('{"ticket":"'..string.rep("a",36)..'","did":"'..string.rep("b",24)..'"}')
    else error("Unexpected endpoint: "..route) end
    return 1,200
  end
}
local options={http=http,ltn12=ltn12}
assert(Auth.validEmail("player@example.com"))
assert(not Auth.validEmail("not-an-email"))
assert(not Auth.requestCode("invalid",options))
local start=assert(Auth.requestCode("player@example.com",options))
assert(start.flow==flow)
assert(not Auth.verifyCode(flow,"12345",options))
local verified=assert(Auth.verifyCode(flow,"123456",options))
assert(verified.token==token)
local profile=assert(Auth.getAccount(token,options))
assert(profile.name=="Original Name")
local ticket=assert(Join.guest({http=http,ltn12=ltn12,authToken=token}))
assert(ticket.ticket==string.rep("a",36))
assert(http.TIMEOUT==13)
assert(not Auth.requestCode("player@example.com",{host="example.com",http=http,ltn12=ltn12}))
assert(not Join.guest({authToken='not valid token',http=http,ltn12=ltn12}))
print("local account emulator email/code and authenticated Node join tests passed")
