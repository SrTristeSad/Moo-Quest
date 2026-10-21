package.path="./?.lua;./?/init.lua;"..package.path
local Auth=require("src.net.local_auth")
local Json=require("src.net.json")
local token="eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhIn0.S1gn4tur3"
local calls,records={},{}
local ltn12={
 source={string=function(s)
   local used=false
   return function()if used then return nil end;used=true;return s end
 end},
 sink={table=function(out)
   return function(x)if x then out[#out+1]=x end;return 1 end
 end}
}
local http={TIMEOUT=17,request=function(req)
  local pieces={}
  while true do local chunk=req.source();if not chunk then break end
    pieces[#pieces+1]=chunk end
  local encoded=table.concat(pieces)
  local payload=assert(Json.decode(encoded))
  assert(payload.auth==token and req.url:find("127.0.0.1",1,true))
  calls[#calls+1]={url=req.url,data=payload}
  if req.url:find("/api/name",1,true) then
    assert(payload.name=="Alpha_1")
    req.sink('{"name":"Alpha_1"}')
  elseif req.url:find("/api/clan/mine",1,true) then
    req.sink('{"clan":null,"invites":[{"clan":"ABC","by":"Friend"}]}')
  elseif req.url:find("/api/clan/create",1,true) then
    assert(payload.name=="ABC")
    req.sink("{}")
  elseif req.url:find("/api/clan/answer",1,true) then
    assert(payload.accept==false and payload.clan=="ABC")
    req.sink("{}")
  elseif req.url:find("/api/clan/requests",1,true) then
    assert(payload.open==true)
    req.sink("{}")
  else error("Unexpected API route "..req.url) end
  return 1,200
end}
local options={http=http,ltn12=ltn12}
assert(Auth.claimName(token,"Alpha_1",options)=="Alpha_1")
local mine=assert(Auth.clanMine(token,options))
assert(mine.clan==Json.null and mine.invites[1].clan=="ABC")
assert(Auth.clanAction(token,"create",{name="ABC"},options))
assert(Auth.clanAction(token,"answer",{clan="ABC",accept=false},options))
assert(Auth.clanAction(token,"requests",{open=true},options))
assert(#calls==5 and http.TIMEOUT==17)
assert(not Auth.claimName(nil,"Alpha_1",options))
assert(not Auth.clanAction(token,"../../admin",{},options))
assert(not Auth.clanAction(token,"create",{name="ABC"},{host="example.com",http=http,ltn12=ltn12}))
assert(#calls==5)
print("authenticated name/clan API JSON and permission guard tests passed")
