-- Public V2 admission policy read from /api/capabilities.
-- It is informational: admission is always enforced by the Node server.
-- Do not send account passwords, access tokens or refresh tokens here.
local Response=require("src.net.v2_response")
local M={}
function M.get(options)
  options=options or {}
  local host=options.host or "127.0.0.1"
  local port=options.port or 8080
  if host~="127.0.0.1" and host~="localhost" then
    return nil,"Consulta V2 exige a ponte HTTPS local."
  end
  if type(port)~="number" or port%1~=0 or port<1 or port>65535 then
    return nil,"Porta V2 invalida."
  end
  local http=options.http or require("socket.http")
  local ltn12=options.ltn12 or require("ltn12")
  local chunks={}
  local previous=http.TIMEOUT
  http.TIMEOUT=4
  local ok,success,status,headers=pcall(http.request,{
    url="http://"..host..":"..port.."/api/capabilities",
    method="GET",
    headers={
      ["Accept"]="application/json",
      ["Accept-Encoding"]="identity",
      ["Connection"]="close"
    },
    sink=ltn12.sink.table(chunks)
  })
  http.TIMEOUT=previous
  if not ok then return nil,"Nao foi possivel consultar regras V2." end
  if not success then return nil,"Consulta de regras V2 falhou." end
  local parsed,why,code=Response.decode(chunks,status,headers,8192)
  if not parsed then return nil,why end
  if code~=200 then return nil,"API V2 HTTP "..code..": regras indisponiveis" end
  if parsed.build~="mqv2native" then
    return nil,"Servidor inesperado: identificador V2 incorreto."
  end
  if parsed.guestEnabled~=nil and type(parsed.guestEnabled)~="boolean" then
    return nil,"Resposta V2 invalida: convidados."
  end
  if parsed.registrationEnabled~=nil and
      type(parsed.registrationEnabled)~="boolean" then
    return nil,"Resposta V2 invalida: cadastro."
  end
  return {
    guestEnabled=parsed.guestEnabled~=nil and parsed.guestEnabled or
      (parsed.guestEnabled==false and false or parsed.guestAdmission~="disabled"),
    registrationEnabled=parsed.registrationEnabled
  }
end
return M
