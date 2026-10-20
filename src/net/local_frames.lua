-- Length-prefixed MessagePack for the project's explicit localhost Lua protocol.
-- This is NOT the original MooMoo/FRVR WebSocket wire protocol.
-- Both ends of this connection are under the Moo-Quest project's control.
local pack=require("src.protocol.msgpack")
local M={}
M.maxBytes=1048576
local function u32(n)
  return string.char(math.floor(n/16777216)%256,math.floor(n/65536)%256,math.floor(n/256)%256,n%256)
end
local function fromU32(s)
  local a,b,c,d=s:byte(1,4)
  return a*16777216+b*65536+c*256+d
end
function M.encode(message)
  local data=pack.encode(message)
  assert(#data>0 and #data<=M.maxBytes,"local packet too large")
  return u32(#data)..data
end
-- Decode complete messages while retaining any partial frame.
function M.decode(buffer)
  if type(buffer)~="string" then return nil,buffer,"invalid buffer" end
  local out={}
  local pos=1
  while #buffer-pos+1>=4 do
    local length=fromU32(buffer:sub(pos,pos+3))
    if length<1 or length>M.maxBytes then return nil,buffer,"invalid frame length" end
    if #buffer-pos+1<length+4 then break end
    local ok,msg=pcall(pack.decode,buffer:sub(pos+4,pos+3+length))
    if not ok then return nil,buffer,"malformed MessagePack: "..tostring(msg) end
    if type(msg)~="table" then return nil,buffer,"packet must be array" end
    out[#out+1]=msg
    pos=pos+4+length
  end
  return out,buffer:sub(pos)
end
return M
