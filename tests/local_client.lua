package.path="./?.lua;./?/init.lua;"..package.path
local Client=require("src.net.local_client")
local Frames=require("src.net.local_frames")
local Pack=require("src.protocol.msgpack")
local sent={}
local incoming={}
local closed=false
local tcp={}
function tcp:settimeout(n) assert(n==0) end
function tcp:connect(host,port)
  assert(host=="127.0.0.1" and port==17017)
  return nil,"timeout"
end
function tcp:getpeername() return "127.0.0.1",17017 end
function tcp:send(data)
  sent[#sent+1]=data
  return #data
end
function tcp:receive(n)
  local chunk=table.remove(incoming,1)
  if chunk then return nil,"timeout",chunk end
  return nil,"timeout",""
end
function tcp:close() closed=true end
local socket={
  tcp=function() return tcp end,
  select=function(_,w,timeout)
    assert(timeout==0 and w[1]==tcp)
    return {},{tcp}
  end
}
local client=Client.new({socket=socket})
assert(client:connect(17017))
assert(client.state=="connecting")
client:update()
assert(client.state=="open")
assert(client:queue({"M",{Pack.map({name="Player",skin=0,moofoll=false,anon=false})}}))
client:update()
assert(#sent==1)
local messages=assert(Frames.decode(sent[1]))
assert(messages[1][1]=="M" and messages[1][2][1].name=="Player")
local world=Frames.encode({"event","C",{7}})
incoming[1]=world:sub(1,3)
incoming[2]=world:sub(4,7)
incoming[3]=world:sub(8)
client:update()
local received=client:drain()
assert(#received==1 and received[1][1]=="event" and received[1][2]=="C" and received[1][3][1]==7)
client:close()
assert(closed and client.state=="closed")
print("Node native TCP transport mock test passed")
