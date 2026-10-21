package.path="./?.lua;./?/init.lua;"..package.path
local Build=require("src.protocol.original_build")
local json='{"buildId":"correct001","salt":12345678,"rounds":5,'..
  '"tapA":1,"tapB":3,"rotA":11,"rotB":19,"mult":16777619,'..
  '"constants":[11,22,33,44,55,66,77,88]}'
local stale=json:gsub("correct001","stale0001")
local originalOpen=io.open
local originalGetenv=os.getenv
io.open=function(name,mode)
  if name=="stale-build.json" or name=="matching-build.json" then
    local data=(name=="matching-build.json") and json or stale
    return {
      read=function() return data end,
      close=function() end
    }
  end
  return nil
end
os.getenv=function(name)
  if name=="MOOQUEST_BUILD_FILE" then return "missing-build.json" end
  if name=="PROTOCOL_BUILD_FILE" then return "stale-build.json" end
  if name=="DATA_DIR" then return "" end
  if name=="MOOQUEST_SERVER_DIR" then return "node-runtime" end
  return originalGetenv(name)
end
local none,reason=Build.load("correct001")
assert(none==nil and type(reason)=="string",
  "missing/stale build cannot be used to authenticate Lua")
os.getenv=function(name)
  if name=="MOOQUEST_BUILD_FILE" then return "missing-build.json" end
  if name=="PROTOCOL_BUILD_FILE" then return "matching-build.json" end
  return originalGetenv(name)
end
local result,err,filename=Build.load("correct001")
assert(result and not err and filename=="matching-build.json")
assert(result.buildId=="correct001" and result.salt==12345678)
local mismatch,msg=Build.load("wrong999")
assert(mismatch==nil and msg:find("diferente"),"stale server build must be rejected")
local list=Build.candidates()
assert(list[1]=="missing-build.json" and list[2]=="matching-build.json")
io.open=originalOpen
os.getenv=originalGetenv
print("original build loader recovers from nonexistent paths and rejects mismatching /ping builds")
