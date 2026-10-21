package.path="./?.lua;./?/init.lua;"..package.path
local Accounts=require("src.net.v2_accounts")
local Join=require("src.net.v2_join")
local Json=require("src.net.json")
local token=string.rep("a",64)
local refreshToken=string.rep("d",64)
local rotatedToken=string.rep("e",64)
local rotatedRefresh=string.rep("f",64)
local operations={}
local ltn12={
  source={string=function(body)
    local done=false
    return function() if done then return nil end done=true return body end
  end},
  sink={table=function(list)
    return function(chunk) if chunk then list[#list+1]=chunk end return 1 end
  end}
}
local http={TIMEOUT=16,request=function(req)
  local pieces={}
  while true do
    local value=req.source()
    if not value then break end
    pieces[#pieces+1]=value
  end
  local raw=table.concat(pieces)
  assert(tonumber(req.headers["Content-Length"])==#raw)
  local data=raw~="" and assert(Json.decode(raw)) or {}
  operations[#operations+1]={url=req.url,data=data,auth=req.headers.Authorization}
  if req.url:match("/api/account/register$") then
    assert(req.headers.Authorization==nil)
    assert(data.username=="User_123" and data.password=="LongPassword12")
    req.sink('{"id":"id-123","username":"User_123"}')
    return 1,201
  elseif req.url:match("/api/account/login$") then
    assert(req.headers.Authorization==nil)
    assert(data.username=="User_123" and data.password=="LongPassword12")
    req.sink('{"token":"'..token..'","refreshToken":"'..refreshToken..
      '","id":"id-123","username":"User_123","expiresIn":28800,"refreshExpiresIn":2592000}')
    return 1,200
  elseif req.url:match("/api/account/refresh$") then
    assert(req.headers.Authorization==nil)
    assert(data.refreshToken==refreshToken)
    req.sink('{"token":"'..rotatedToken..'","refreshToken":"'..rotatedRefresh..
      '","id":"id-123","username":"User_123","expiresIn":28800}')
    return 1,200
  elseif req.url:match("/api/account/me$") then
    assert(req.headers.Authorization=="Bearer "..token)
    req.sink('{"id":"id-123","username":"User_123"}')
    return 1,200
  elseif req.url:match("/api/account/logout$") then
    if req.headers.Authorization==nil then
      assert(data.refreshToken==rotatedRefresh)
    else
      assert(req.headers.Authorization=="Bearer "..token)
    end
    req.sink('{"ok":true}')
    return 1,200
  elseif req.url:match("/api/join$") then
    assert(data.host=="http://127.0.0.1:8080/s/LC")
    assert(data.auth==nil and data.authToken==nil)
    if req.headers.Authorization then
      assert(req.headers.Authorization=="Bearer "..token)
      assert(data.captcha==nil)
    else
      assert(data.captcha==true)
    end
    req.sink('{"ticket":"'..string.rep("b",36)..'","did":"'..string.rep("c",32)..'"}')
    return 1,200
  end
  error("Unexpected V2 API endpoint: "..req.url)
end}
local opts={http=http,ltn12=ltn12}
assert(Accounts.validUsername("User_123"))
assert(not Accounts.validUsername("bad name"))
assert(not Accounts.validPassword("short"))
assert(not Accounts.register("bad name","LongPassword12",opts))
local registration=assert(Accounts.register("User_123","LongPassword12",opts))
assert(registration.username=="User_123")
local user=assert(Accounts.login("User_123","LongPassword12",opts))
assert(user.token==token and user.refreshToken==refreshToken
  and user.expiresIn==28800)
local rotated=assert(Accounts.refresh(refreshToken,opts))
assert(rotated.token==rotatedToken and rotated.refreshToken==rotatedRefresh)
assert(not Accounts.refresh("bad-token",opts))
assert(assert(Accounts.me(token,opts)).username=="User_123")
local authenticated=assert(Join.guest({http=http,ltn12=ltn12,authToken=token}))
assert(authenticated.ticket==string.rep("b",36))
assert(Join.guest({http=http,ltn12=ltn12}))
assert(Accounts.logout(token,opts))
assert(Accounts.logout(nil,opts,rotatedRefresh))
assert(http.TIMEOUT==16)
assert(not Accounts.login("User_123","LongPassword12",{host="example.com",http=http,ltn12=ltn12}))
assert(not Join.guest({http=http,ltn12=ltn12,authToken="invalid"}))
assert(#operations==8)
print("Independent V2 account login, register, logout and Bearer join tests passed")
