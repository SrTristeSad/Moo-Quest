-- DIRECT client of unmodified al007ex/moomoo-clone WebSocket endpoint.
-- No nativeBridge, no unofficial local TCP framing.
-- Incomplete: the original server requires build-pinned encrypted gameplay
-- frames, join ticket and browser seal/telemetry. This module does NOT fake them.
local SocketWS=require("src.net.websocket_client")
local Bootstrap=require("src.protocol.bootstrap")
local Random=require("src.net.secure_random")
local Original={}
Original.__index=Original

local function validHost(h)
  return type(h)=="string" and h:match("^[%w%.%-]+$")~=nil
end
local function validPort(n)
  return type(n)=="number" and n>=1 and n<=65535 and n%1==0
end
local function httpPing(socketHttp,host,port)
  local oldTimeout=socketHttp.TIMEOUT
  socketHttp.TIMEOUT=2
  local ok,data,code=pcall(socketHttp.request,
    "http://"..host..":"..port.."/ping")
  socketHttp.TIMEOUT=oldTimeout
  if not ok then return nil,"GET /ping falhou: "..tostring(data) end
  if tonumber(code)~=200 then return nil,"GET /ping HTTP "..tostring(code) end
  if type(data)~="string" or #data>32768 then return nil,"resposta /ping invalida" end
  local build=data:match('"build"%s*:%s*"([%w]+)"')
  if not build or #build>100 then return nil,"identificador do build ausente no /ping" end
  return build
end
function Original.new(options)
  options=options or {}
  local socketHttp=options.http or require("socket.http")
  return setmetatable({
    host=options.host or "127.0.0.1",port=options.port or 8080,
    server=options.server or "LC",
    http=socketHttp,random=options.random or Random.bytes,
    sha1=options.sha1 or function(data) return love.data.hash("sha1",data) end,
    socketLib=options.socket,
    state="idle",status="Servidor original ainda nao conectado.",
    error=nil,build=nil,handshake=nil,websocket=nil,events={}
  },Original)
end
function Original:connect()
  if not validHost(self.host) or not validPort(self.port) then
    self.state="failed";self.error="Endereco local invalido"
    return false,self.error
  end
  if not self.server:match("^[%w]+$") then
    self.state="failed";self.error="Servidor de jogo invalido"
    return false,self.error
  end
  self:close()
  local build,reason=httpPing(self.http,self.host,self.port)
  if not build then
    self.state="failed";self.error=reason
    self.status="Servidor original indisponivel: "..reason
    return false,reason
  end
  self.build=build
  local options={secureRandom=self.random,sha1=self.sha1}
  if self.socketLib then options.socket=self.socketLib end
  local ws=SocketWS.new(options)
  -- The original server validates ?b= and may require ?u= and join ticket.
  -- We do not fabricate these, or claim that HTTP 101 means a game session.
  local path="/s/"..self.server.."?b="..build
  local ok,err=ws:connect(self.host,self.port,path)
  if not ok then
    self.state="failed";self.error=err
    self.status="Falha no WebSocket original: "..tostring(err)
    return false,err
  end
  self.websocket=ws
  self.state="connecting"
  self.error=nil
  self.status="Conectando diretamente: ws://"..self.host..":"..self.port..path
  return true
end
function Original:update()
  local ws=self.websocket
  if not ws then return end
  ws:update()
  for _,evt in ipairs(ws:drain()) do
    if evt.kind=="open" then
      self.state="waiting_handshake"
      self.status="WebSocket original aberto; aguardando io-init..."
    elseif evt.kind=="binary" then
      if not self.handshake then
        local handshake,err=Bootstrap.decodeHandshake(evt.value)
        if not handshake then
          self.state="failed"
          self.error="Handshake original invalido: "..tostring(err)
          self.status=self.error
          ws:close()
        else
          self.handshake=handshake
          self.state="handshake_received"
          self.status="io-init original recebido. Protocolo autenticado ainda pendente."
          self.events[#self.events+1]={kind="io-init",data=handshake}
        end
      else
        self.events[#self.events+1]={kind="encrypted_frame",length=#evt.value}
      end
    elseif evt.kind=="close" then
      self.state="closed"
      self.status="Servidor original encerrou a conexao (ticket/build/integridade)."
      self.error=self.status
    elseif evt.kind=="error" then
      self.state="failed"
      self.error=tostring(evt.value)
      self.status="Erro no WebSocket original: "..self.error
    end
  end
  if ws.state=="closed" and self.state~="closed" and self.state~="failed" then
    self.state="closed"
    self.status="Conexao original fechada antes de entrar no jogo."
  end
end
function Original:drain()
  local events=self.events
  self.events={}
  return events
end
function Original:close()
  if self.websocket then self.websocket:close() end
  self.websocket=nil
  self.handshake=nil
  self.events={}
end
return Original
