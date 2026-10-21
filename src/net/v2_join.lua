-- Authenticated/guest join against the independent V2 endpoint.
-- Never send access tokens inside URL parameters or the JSON request body.
local Json=require("src.net.json")
local M={}
local function isLocal(host) return host=="127.0.0.1" or host=="localhost" end
function M.guest(options)
  options=options or {}
  local host,port,server=options.host or "127.0.0.1",
    options.port or 8080,options.server or "LC"
  if not isLocal(host) then return nil,"Cliente V2 requer HTTPS/WSS para acesso remoto" end
  if type(port)~="number" or port<1 or port>65535 or port%1~=0 then
    return nil,"Porta do servidor V2 invalida"
  end
  if server~="LC" then return nil,"Sala V2 desconhecida" end
  local authToken=options.authToken
  if authToken~=nil and (type(authToken)~="string" or #authToken~=64
    or not authToken:match("^[a-f0-9]+$")) then
    return nil,"Token V2 invalido"
  end
  local data={host="http://"..host..":"..port.."/s/LC"}
  if not authToken then data.captcha=true end -- LOCAL development only
  if type(options.did)=="string" and #options.did>=16 and #options.did<=64
    and options.did:match("^[a-f0-9]+$") then data.did=options.did end
  local body,err=Json.encode(data)
  if not body then return nil,"JSON de ingresso invalido: "..tostring(err) end
  local http=options.http or require("socket.http")
  local ltn12=options.ltn12 or require("ltn12")
  local headers={
    ["Content-Type"]="application/json",
    ["Content-Length"]=tostring(#body),
    ["Connection"]="close"
  }
  if authToken then headers["Authorization"]="Bearer "..authToken end
  local chunks={},oldTimeout=http.TIMEOUT
  http.TIMEOUT=5
  local ok,result,status=pcall(http.request,{
    url="http://"..host..":"..port.."/api/join",method="POST",
    headers=headers,source=ltn12.source.string(body),
    sink=ltn12.sink.table(chunks)
  })
  http.TIMEOUT=oldTimeout
  if not ok then return nil,"Erro de ingresso V2: "..tostring(result) end
  if not result then return nil,"API V2 indisponivel: "..tostring(status) end
  local raw=table.concat(chunks)
  if #raw>8192 then return nil,"Ticket V2 excede limite" end
  local response,why=Json.decode(raw)
  if type(response)~="table" then
    return nil,"Ticket V2 invalido: "..tostring(why)
  end
  if tonumber(status)~=200 then
    return nil,"API V2 HTTP "..tostring(status)..": "..tostring(response.error or "recusado")
  end
  local ticket,did=response.ticket,response.did
  if type(ticket)~="string" or #ticket~=36
    or not ticket:match("^[a-f0-9]+$") or type(did)~="string"
    or #did<16 or #did>64 or not did:match("^[a-f0-9]+$") then
    return nil,"API V2 nao retornou ticket valido"
  end
  return {ticket=ticket,did=did,host=data.host}
end
return M
