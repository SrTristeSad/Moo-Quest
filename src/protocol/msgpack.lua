-- Minimal independent MessagePack codec for protocol bootstrap.
-- Supports nil, booleans, signed/unsigned integers <= 32 bits, UTF-8 strings,
-- binary strings (as Lua strings), and arrays. Maps/floats/ext are not supported.
local M={}
local function be(n,count)
  local out={}
  for i=count-1,0,-1 do out[#out+1]=string.char(math.floor(n/256^i)%256) end
  return table.concat(out)
end
local function encode(v)
  local t=type(v)
  if t=="nil" then return string.char(0xc0) end
  if t=="boolean" then return string.char(v and 0xc3 or 0xc2) end
  if t=="number" then
    assert(v==math.floor(v) and v>=-2147483648 and v<=4294967295,"unsupported integer")
    if v>=0 then
      if v<=127 then return string.char(v) end
      if v<=255 then return string.char(0xcc,v) end
      if v<=65535 then return string.char(0xcd)..be(v,2) end
      return string.char(0xce)..be(v,4)
    end
    if v>=-32 then return string.char(256+v) end
    if v>=-128 then return string.char(0xd0,256+v) end
    if v>=-32768 then return string.char(0xd1)..be(v+65536,2) end
    return string.char(0xd2)..be(v+4294967296,4)
  end
  if t=="string" then
    local n=#v
    if n<=31 then return string.char(0xa0+n)..v end
    if n<=255 then return string.char(0xd9,n)..v end
    if n<=65535 then return string.char(0xda)..be(n,2)..v end
    return string.char(0xdb)..be(n,4)..v
  end
  if t=="table" then
    local n=#v
    local head
    if n<=15 then head=string.char(0x90+n)
    elseif n<=65535 then head=string.char(0xdc)..be(n,2)
    else error("array too large") end
    local out={head}
    for i=1,n do out[#out+1]=encode(v[i]) end
    return table.concat(out)
  end
  error("unsupported type "..t)
end
function M.encode(value) return encode(value) end
function M.decode(data)
  assert(type(data)=="string","binary string expected")
  local pos=1
  local function read(n)
    if pos+n-1>#data then error("truncated msgpack") end
    local s=data:sub(pos,pos+n-1)
    pos=pos+n
    return s
  end
  local function uint(n)
    local s=read(n)
    local v=0
    for i=1,#s do v=v*256+s:byte(i) end
    return v
  end
  local parse
  parse=function(depth)
    if depth>32 then error("msgpack nesting limit") end
    local b=uint(1)
    if b<=0x7f then return b end
    if b>=0xe0 then return b-256 end
    if b>=0xa0 and b<=0xbf then return read(b-0xa0) end
    if b>=0x90 and b<=0x9f then
      local arr={}
      for i=1,b-0x90 do arr[i]=parse(depth+1) end
      return arr
    end
    if b==0xc0 then return nil end
    if b==0xc2 then return false end
    if b==0xc3 then return true end
    if b==0xcc then return uint(1) end
    if b==0xcd then return uint(2) end
    if b==0xce then return uint(4) end
    if b==0xd0 then local v=uint(1);return v>=128 and v-256 or v end
    if b==0xd1 then local v=uint(2);return v>=32768 and v-65536 or v end
    if b==0xd2 then local v=uint(4);return v>=2147483648 and v-4294967296 or v end
    if b==0xd9 then return read(uint(1)) end
    if b==0xda then return read(uint(2)) end
    if b==0xdb then return read(uint(4)) end
    if b==0xdc then
      local n=uint(2);local arr={}
      for i=1,n do arr[i]=parse(depth+1) end
      return arr
    end
    error(string.format("unsupported msgpack prefix 0x%02x",b))
  end
  local value=parse(0)
  if pos<=#data then error("trailing msgpack bytes") end
  return value
end
return M
