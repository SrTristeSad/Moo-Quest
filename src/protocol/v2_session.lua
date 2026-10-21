-- Moo-Quest's V2 session codec. This code speaks only the independent
-- native server's unpinned MessagePack/HMAC wire; no browser build files,
-- proprietary attestations or legacy server modules are needed.
local MP=require("src.protocol.msgpack")
local T={}
T.__index=T
local MOD=4294967296
local C2S={"M","D","9","e","F","z","H","K","L","N","b","P","Q","c","6","S","0"}
local S2C={"A","B","C","D","E","a","G","H","I","J","K","L","M","N","O","P",
  "Q","R","S","T","U","V","X","Y","Z","g","1","2","3","4","5","6","7","8","9","0"}
local bitlib
do
  local ok,result=pcall(require,"bit")
  if ok then bitlib=result else bitlib=bit32 end
end
local function u32(v) return v%MOD end
local function binary(a,b,mode)
  a=u32(a);b=u32(b)
  local result,p=0,1
  for _=1,32 do
    local x,y=a%2,b%2
    if (mode=="xor" and x~=y) or (mode=="or" and (x==1 or y==1)) then
      result=result+p
    end
    a=math.floor(a/2);b=math.floor(b/2);p=p*2
  end
  return result
end
local function bxor(a,b)
  return bitlib and u32(bitlib.bxor(a,b)) or binary(a,b,"xor")
end
local function bor(a,b)
  return bitlib and u32(bitlib.bor(a,b)) or binary(a,b,"or")
end
local function shr(a,n)
  return bitlib and u32(bitlib.rshift(a,n)) or math.floor(u32(a)/2^n)
end
local function imul(a,b)
  a=u32(a);b=u32(b)
  local a0,b0=a%65536,b%65536
  local a1,b1=math.floor(a/65536),math.floor(b/65536)
  return u32(a0*b0+((a1*b0+a0*b1)%65536)*65536)
end
local function generator(seed)
  local state=u32(seed)
  return function()
    state=u32(state+1831565813)
    local t=imul(bxor(state,shr(state,15)),bor(state,1))
    t=bxor(t,u32(t+imul(bxor(t,shr(t,7)),bor(t,61))))
    return u32(bxor(t,shr(t,14)))/MOD
  end
end
local function tableFor(names,seed)
  local rnd=generator(seed)
  local ids={}
  for i=1,#names do ids[i]=i-1 end
  for i=#names,2,-1 do
    local j=math.floor(rnd()*i)+1
    ids[i],ids[j]=ids[j],ids[i]
  end
  local tableMap={enc={},dec={}}
  for i,name in ipairs(names) do
    tableMap.enc[name]=ids[i]
    tableMap.dec[ids[i]]=name
  end
  return tableMap
end
local function fromHex(value)
  if type(value)~="string" or #value~=32 or not value:match("^[a-fA-F0-9]+$") then
    return nil
  end
  return value:gsub("..",function(v)return string.char(tonumber(v,16))end)
end
local function hmac(key,body,digest)
  -- HMAC-SHA256 with the 16-byte random session key. The server authenticates
  -- client frames and burns any failed MAC or out-of-sequence request.
  local padded=key..string.rep("\0",64-#key)
  local inner,outer={},{}
  for i=1,64 do
    local byte=padded:byte(i)
    inner[i]=string.char(bxor(byte,0x36))
    outer[i]=string.char(bxor(byte,0x5c))
  end
  local mid=digest(table.concat(inner)..body)
  if type(mid)~="string" or #mid~=32 then return nil,"invalid sha256 digest" end
  local tag=digest(table.concat(outer)..mid)
  if type(tag)~="string" or #tag~=32 then return nil,"invalid sha256 digest" end
  return tag:sub(1,6)
end
function T.new(handshake,_,digest)
  if type(handshake)~="table" or handshake.mode~=1 or handshake.pinned or
     handshake.sealMode~=0 then
    return nil,"V2 requires an unpinned native handshake without browser seal"
  end
  if type(digest)~="function" then return nil,"SHA256 function is required" end
  local key=fromHex(handshake.rawKeyHex)
  if not key then return nil,"Invalid V2 session key" end
  local seed=handshake.seed
  if type(seed)~="number" or seed%1~=0 or seed<0 or seed>=MOD then
    return nil,"Invalid V2 seed"
  end
  local tableSeed=bxor(seed,0x9e3779b1)
  return setmetatable({
    key=key,digest=digest,sent=0,received=0,sealMode=0,
    tables={c2s=tableFor(C2S,tableSeed),
      s2c=tableFor(S2C,bxor(tableSeed,0x85ebca6b))}
  },T)
end
function T:encode(name,args)
  if type(name)~="string" or type(args)~="table" or #args>16 then
    return nil,"invalid V2 command"
  end
  local id=self.tables.c2s.enc[name]
  if id==nil then return nil,"unsupported V2 command: "..name end
  local seq=self.sent+1
  local ok,body=pcall(MP.encode,{id,args,seq})
  if not ok or type(body)~="string" or #body>2042 then
    return nil,"invalid V2 packet size or data"
  end
  local tag,err=hmac(self.key,body,self.digest)
  if not tag then return nil,err end
  self.sent=seq
  return tag..body
end
function T:decode(frame)
  if type(frame)~="string" or #frame>65536 then
    return nil,"invalid V2 server frame"
  end
  local ok,record=pcall(MP.decode,frame)
  if not ok or type(record)~="table" or #record~=2 or
    type(record[1])~="number" or type(record[2])~="table" then
    return nil,"malformed V2 server packet"
  end
  local name=self.tables.s2c.dec[record[1]]
  if not name then return nil,"unknown V2 server event" end
  self.received=self.received+1
  return {name=name,args=record[2]}
end
return T
