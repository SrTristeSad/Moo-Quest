-- Client-side nonblocking loopback TCP link for Moo-Quest native Lua server.
-- Uses the framed MessagePack API defined in src/net/local_frames.lua.
local Frames=require("src.net.local_frames")
local Client={}
Client.__index=Client
function Client.new(options)
  options=options or {}
  local socket=options.socket or require("socket")
  return setmetatable({
    socketLib=socket, socket=nil, state="idle", input="", output="",
    messages={}, error=nil, port=nil
  },Client)
end
function Client:connect(port)
  if self.socket then return false,"connection active" end
  self.port=port or 17017
  local sock,err=self.socketLib.tcp()
  if not sock then self.state="failed";self.error=err;return false,err end
  sock:settimeout(0)
  local ok,reason=sock:connect("127.0.0.1",self.port)
  if not ok and reason~="timeout" and reason~="Operation already in progress" and reason~="already connected" then
    sock:close()
    self.state="failed";self.error=reason
    return false,reason
  end
  self.socket=sock
  self.state=(ok or reason=="already connected") and "open" or "connecting"
  return true
end
function Client:queue(message)
  if self.state~="open" then return false,"connection not open" end
  local data=Frames.encode(message)
  if #self.output+#data>2097152 then return false,"output queue too large" end
  self.output=self.output..data
  return true
end
function Client:close()
  if self.socket then pcall(function() self.socket:close() end) end
  self.socket=nil
  self.state="closed"
end
function Client:fail(why)
  self.error=tostring(why)
  self:close()
  self.state="failed"
end
function Client:update()
  local s=self.socket
  if not s then return end
  if self.state=="connecting" then
    local _,writable,err=self.socketLib.select(nil,{s},0)
    if err and err~="timeout" then self:fail(err);return end
    if not writable or #writable==0 then return end
    -- Writable can also signal a failed asynchronous connect.
    local ip=s:getpeername()
    if not ip then self:fail("TCP connect refused");return end
    self.state="open"
  end
  if #self.output>0 then
    local sent,err,last=s:send(self.output)
    local n=sent or last or 0
    if n>0 then self.output=self.output:sub(n+1) end
    if err and err~="timeout" then self:fail(err);return end
  end
  for _=1,4 do
    local data,err,partial=s:receive(8192)
    local chunk=data or partial or ""
    if #chunk>0 then self.input=self.input..chunk end
    if #self.input>Frames.maxBytes+4 then self:fail("receive buffer too large");return end
    if #chunk>0 then
      local msgs,rest,decodeError=Frames.decode(self.input)
      if not msgs then self:fail(decodeError);return end
      self.input=rest
      for _,msg in ipairs(msgs) do self.messages[#self.messages+1]=msg end
      if #self.messages>128 then self:fail("event queue too large");return end
    end
    if err=="closed" then self:close();return end
    if err and err~="timeout" then self:fail(err);return end
    if #chunk==0 then break end
  end
end
function Client:drain()
  local messages=self.messages
  self.messages={}
  return messages
end
return Client
