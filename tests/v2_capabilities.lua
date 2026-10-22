package.path="./?.lua;./?/init.lua;"..package.path
local Capabilities=require("src.net.v2_capabilities")
local Json=require("src.net.json")
local function mocked(body,status,headers)
  local requests={}
  local http={TIMEOUT=19}
  function http.request(req)
    requests[#requests+1]=req
    assert(req.url=="http://127.0.0.1:8080/api/capabilities")
    assert(req.method=="GET")
    assert(req.headers["Accept"]=="application/json")
    assert(req.headers["Accept-Encoding"]=="identity")
    assert(not req.headers.Authorization,"Public capability request must not contain token")
    req.sink(body)
    return 1,status or 200,headers or {["content-type"]="application/json"}
  end
  return {http=http,ltn12={sink={table=function(list)
    return function(chunk)if chunk then list[#list+1]=chunk end return 1 end
  end}}},requests
end
local function packet(reg,guest)
  return assert(Json.encode({
    build="mqv2native",guestEnabled=guest,registrationEnabled=reg,
    guestAdmission=guest and "verified_challenge" or "disabled"
  }))
end
local opts,requests=mocked(packet(false,false))
local disabled=assert(Capabilities.get(opts))
assert(disabled.guestEnabled==false and disabled.registrationEnabled==false)
assert(#requests==1 and opts.http.TIMEOUT==19)
local allowed=assert(Capabilities.get(mocked(packet(true,true))))
assert(allowed.registrationEnabled==true and allowed.guestEnabled==true)
local legacy=assert(Capabilities.get(mocked(
  '{"build":"mqv2native","guestAdmission":"direct_loopback_only"}')))
assert(legacy.guestEnabled==true and legacy.registrationEnabled==nil)
local blocked=assert(Capabilities.get(mocked(
  '{"build":"mqv2native","guestAdmission":"disabled"}')))
assert(blocked.guestEnabled==false)
local invalid,reason=Capabilities.get(mocked(
  '{"build":"other","guestEnabled":true,"registrationEnabled":true}'))
assert(not invalid and reason:find("inesperado"))
assert(not Capabilities.get(mocked(
  '{"build":"mqv2native","guestEnabled":"true","registrationEnabled":true}')))
assert(not Capabilities.get(mocked(
  '{"build":"mqv2native","guestEnabled":false,"registrationEnabled":"yes"}')))
local html=assert(Capabilities.get(mocked(packet(true,true))))
assert(html.registrationEnabled)
local blockedHtml,errorHtml=Capabilities.get(mocked("<html>Cloudflare</html>",
  403,{["content-type"]="text/html"}))
assert(not blockedHtml and errorHtml:find("API V2 HTTP 403",1,true))
local unavailable,why=Capabilities.get({host="remote.example"})
assert(not unavailable and why:find("ponte HTTPS",1,true))
print("V2 capabilities: policies, legacy fields, WAF errors, no credentials and limits passed")
