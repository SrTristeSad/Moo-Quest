package.path="./?.lua;./?/init.lua;"..package.path
local Response=require("src.net.v2_response")
local Accounts=require("src.net.v2_accounts")
local Join=require("src.net.v2_join")
local function capture(payload,status,headers)
  return {
    TIMEOUT=5,
    request=function(req)
      assert(req.headers["Accept"]=="application/json")
      assert(req.headers["Accept-Encoding"]=="identity")
      if req.headers.Authorization then
        assert(req.headers.Authorization=="Bearer "..string.rep("a",64))
      end
      req.sink(payload)
      return 1,status,headers or {["content-type"]="application/json"}
    end
  }
end
local localLtn12={
  source={string=function(data)
    local used=false
    return function() if used then return nil end used=true return data end
  end},
  sink={table=function(chunks)
    return function(value)
      if value then chunks[#chunks+1]=value end
      return 1
    end
  end}
}
local token=string.rep("a",64)
local opts=function(http) return {http=http,ltn12=localLtn12} end
local body,err=Response.decode({'{"error":"registration_disabled"}'},403,
  {["Content-Type"]="application/json; charset=utf-8"})
assert(body and body.error=="registration_disabled" and not err)
local registered,errorRegister=Accounts.register("User_123","LongPassword12",
  opts(capture('{"error":"registration_disabled"}',403)))
assert(not registered)
assert(errorRegister=="API V2 HTTP 403: registration_disabled")
local account,errorLogin=Accounts.login("User_123","LongPassword12",
  opts(capture('{"error":"invalid_credentials"}',401)))
assert(not account and errorLogin=="API V2 HTTP 401: invalid_credentials")
local junk="<html><title>Access denied</title><body>password=secretneverecho</body></html>"
local good,why=Accounts.register("User_123","LongPassword12",
  opts(capture(junk,403,{["Content-Type"]="text/html; charset=utf-8"})))
assert(not good and why:find("API V2 HTTP 403",1,true))
assert(why:find("pagina HTML",1,true))
assert(why:find("proxy HTTPS/Nginx",1,true))
assert(not why:find("secretneverecho",1,true))
local noType,invalidJson=Accounts.login("User_123","LongPassword12",
  opts(capture(junk,502,{})))
assert(not noType and invalidJson:find("API V2 HTTP 502",1,true))
assert(not invalidJson:find("secretneverecho",1,true))
local compressed,enc=Accounts.login("User_123","LongPassword12",
  opts(capture("compressed",200,{["Content-Encoding"]="gzip",
     ["Content-Type"]="application/json"})))
assert(not compressed and enc:find("comprimida",1,true))
local missing,empty=Accounts.login("User_123","LongPassword12",
  opts(capture("",503,{["content-type"]="application/json"})))
assert(not missing and empty:find("resposta vazia",1,true))
local undecodable,malformed=Accounts.login("User_123","LongPassword12",
  opts(capture('{"token":x}',200,{["Content-Type"]="application/json"})))
assert(not undecodable and malformed:find("JSON malformado",1,true))
assert(not malformed:find("src/net/json.lua",1,true))
local denied,joinError=Join.guest({
  http=capture(junk,403,{["content-type"]="text/html"}),
  ltn12=localLtn12,authToken=token
})
assert(not denied and joinError:find("API V2 HTTP 403",1,true))
assert(not joinError:find("secretneverecho",1,true))
local denied401,why401,code401=Join.guest({
  http=capture('{"error":"invalid_player_token"}',401),
  ltn12=localLtn12,authToken=token
})
assert(not denied401 and code401==401 and why401:find("invalid_player_token",1,true))
assert(capture('{}',200).TIMEOUT==5)
print("V2 API correctly classifies JSON/HTML, proxy errors, compression and 401 without leaking secrets")
