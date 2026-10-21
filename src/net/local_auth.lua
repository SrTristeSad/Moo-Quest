-- Existing reconstructed Node /api/auth/code and /api/auth/verify API.
-- IMPORTANT: the server is a LOCAL EMULATOR; it accepts ANY six digits.
-- This is NOT password authentication, email delivery or secure registration.
-- Keep it on localhost, never advertise these accounts as production security.
local Auth={}
local function isLocal(host)
  return host=="127.0.0.1" or host=="localhost"
end
local function escapeJSON(value)
  assert(type(value)=="string","JSON string required")
  return '"'..value:gsub('[%z\1-\31\\"]',function(ch)
    if ch=='\\' then return '\\\\' end
    if ch=='"' then return '\\"' end
    return string.format('\\u%04x',ch:byte())
  end)..'"'
end
local function request(route,payload,options)
  options=options or {}
  local host,port=options.host or "127.0.0.1",options.port or 8080
  if not isLocal(host) or type(port)~="number" or port<1 or port>65535 then
    return nil,"autenticacao local disponivel apenas em localhost"
  end
  local http=options.http or require("socket.http")
  local ltn12=options.ltn12 or require("ltn12")
  local parts={}
  for k,v in pairs(payload) do parts[#parts+1]=escapeJSON(k)..":"..escapeJSON(v) end
  table.sort(parts)
  local body="{"..table.concat(parts,",").."}"
  local chunks={}
  local oldTimeout=http.TIMEOUT
  http.TIMEOUT=4
  local ok,result,status=pcall(http.request,{
    url="http://"..host..":"..port.."/api/"..route,
    method="POST",
    headers={
      ["Content-Type"]="application/json",
      ["Content-Length"]=tostring(#body),
      ["Connection"]="close"
    },
    source=ltn12.source.string(body),
    sink=ltn12.sink.table(chunks)
  })
  http.TIMEOUT=oldTimeout
  if not ok then return nil,"API de conta indisponivel: "..tostring(result) end
  if not result then return nil,"API de conta nao respondeu: "..tostring(status) end
  local response=table.concat(chunks)
  if #response>16384 then return nil,"resposta de conta muito grande" end
  if tonumber(status)~=200 then
    local kind=response:match('"type"%s*:%s*"([^"]+)"')
      or response:match('"error"%s*:%s*"([^"]+)"')
    return nil,"API de conta HTTP "..tostring(status).." "..tostring(kind or "")
  end
  return response
end
function Auth.validEmail(value)
  if type(value)~="string" or #value<3 or #value>120 then return false end
  if value:find("[%c%s]") then return false end
  return value:match("^[^@]+@[^@]+%.[^@]+$")~=nil
end
function Auth.requestCode(email,options)
  if not Auth.validEmail(email) then return nil,"Informe um email valido (ate 120 caracteres)" end
  local response,err=request("auth/code",{email=email},options)
  if not response then return nil,err end
  local flow=response:match('"flow"%s*:%s*"([a-f0-9]+)"')
  if not flow or #flow~=24 then return nil,"Servidor nao retornou fluxo de conta valido" end
  return {flow=flow,email=email}
end
function Auth.verifyCode(flow,code,options)
  if type(flow)~="string" or #flow~=24 or not flow:match("^[a-f0-9]+$") then
    return nil,"Fluxo local de conta invalido"
  end
  if type(code)~="string" or not code:match("^%d%d%d%d%d%d$") then
    return nil,"O codigo precisa conter seis digitos"
  end
  local response,err=request("auth/verify",{flow=flow,code=code},options)
  if not response then return nil,err end
  local token=response:match('"token"%s*:%s*"([%w%._%-]+)"')
  local id=response:match('"id"%s*:%s*"([a-f0-9]+)"')
  if not token or #token>4096 or not id then
    return nil,"Servidor nao retornou token de conta valido"
  end
  return {token=token,id=id}
end
function Auth.getAccount(token,options)
  if type(token)~="string" or #token<12 or #token>4096
    or not token:match("^[%w%._%-]+$") then
    return nil,"Token de conta invalido"
  end
  local response,err=request("account",{auth=token},options)
  if not response then return nil,err end
  local name=response:match('"name"%s*:%s*"([^"]*)"')
  return {name=name or "",raw=response}
end
return Auth
