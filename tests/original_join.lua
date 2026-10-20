package.path="./?.lua;./?/init.lua;"..package.path
local Join=require("src.net.original_join")
local ticket=string.rep("a",36)
local device=string.rep("b",24)
local lastBody=nil
local fakeHttp={
  TIMEOUT=9,
  request=function(arg)
    assert(type(arg)=="table" and arg.method=="POST")
    assert(arg.url=="http://127.0.0.1:8080/api/join")
    assert(arg.headers["Content-Type"]=="application/json")
    local pieces={}
    while true do
      local part=arg.source()
      if not part then break end
      pieces[#pieces+1]=part
    end
    lastBody=table.concat(pieces)
    assert(tonumber(arg.headers["Content-Length"])==#lastBody)
    arg.sink('{"ticket":"'..ticket..'","did":"'..device..'"}')
    return 1,200
  end
}
local ltn12={
  source={string=function(s)
    local sent=false
    return function()
      if sent then return nil end
      sent=true
      return s
    end
  end},
  sink={table=function(t)
    return function(chunk)
      if chunk then t[#t+1]=chunk end
      return 1
    end
  end}
}
local response=assert(Join.guest({
  host="127.0.0.1",port=8080,server="LC",
  did=device,http=fakeHttp,ltn12=ltn12
}))
assert(response.ticket==ticket and response.did==device)
assert(lastBody:find('"host":"http://127.0.0.1:8080/s/LC"',1,true))
assert(lastBody:find('"captcha":true',1,true))
assert(lastBody:find('"did":"'..device..'"',1,true))
assert(fakeHttp.TIMEOUT==9)
local reject={
  TIMEOUT=4,request=function(opts)
    opts.sink('{"error":"captcha"}')
    return 1,403
  end
}
local bad,reason=Join.guest({http=reject,ltn12=ltn12})
assert(bad==nil and reason:find("403",1,true) and reason:find("captcha",1,true))
local remote,remoteErr=Join.guest({host="example.com",http=fakeHttp,ltn12=ltn12})
assert(remote==nil and remoteErr:find("localhost",1,true))
print("original /api/join guest ticket tests passed")
