package.path="./?.lua;./?/init.lua;"..package.path
local Pause=require("src.game.pause_controls")
local Null=require("src.protocol.msgpack").null
local packets={}
local socket={state="spawn_confirmed"}
function socket:send(name,args)
  packets[#packets+1]={name=name,args=args}
  return true
end
assert(Pause.stop(socket,Null)==true)
assert(#packets==3)
assert(packets[1].name=="9" and packets[1].args[1]==Null,
  "movement direction must be cleared on the authoritative server")
assert(packets[2].name=="e" and #packets[2].args==0,
  "immediate stop must be sent")
assert(packets[3].name=="F" and packets[3].args[1]==0
  and packets[3].args[2]==Null,"held attack must stop")
for _,p in ipairs(packets) do
  assert(p.name~="K","pausing a UI must never toggle auto-attack")
end
packets={}
socket.state="closed"
assert(Pause.stop(socket,Null)==false and #packets==0,
  "do not send packets to a closed session")
print("authoritative input stop and auto-attack preservation passed")
