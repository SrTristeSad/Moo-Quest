-- Account transport for the independently developed Moo-Quest V2 backend.
-- Never use the obsolete e-mail/6-digit demo emulator for real accounts.
-- Local HTTP is intentionally loopback-only until HTTPS/WSS transport exists.
local Json=require("src.net.json")
local M={}
local function origin(options)
  options=options or {}
  local host=options.host or "127.0.0.1"
  local port=options.port or 8080
  if host~="127.0.0.1" and host~="localhost" then
    return nil,"API V2 local: host remoto requer HTTPS/WSS"
  end
  if type(port)~="number" or port%1~=0 or port<1 or port>65535 then
    return nil,"porta de autenticacao invalida"
  end
  return "http://"..host..":"..port
end
function M.validUsername(name)
  return type(name)=="string" and #name>=3 and #name<=20
    and name:match("^[%w_]+$")~=nil
end
function M.validPassword(password)
  return type(password)=="string" and #password>=12 and #password<=128
end
function M.validToken(token)
  return type(token)=="string" and #token==64
    and token:match("^[a-f0-9]+$")~=nil
end
local function request(route,method,data,token,options)
  local url,err=origin(options)
  if not url then return nil,err end
  options=options or {}
  local http=options.http or require("socket.http")
  local ltn12=options.ltn12 or require("ltn12")
  local body=""
  if data~=nil then
    local encoded,why=Json.encode(data)
    if not encoded then return nil,"JSON invalido: "..tostring(why) end
    body=encoded
  end
  local headers={
    ["Content-Type"]="application/json",
    ["Content-Length"]=tostring(#body),
    ["Connection"]="close"
  }
  if token~=nil then
    if not M.validToken(token) then return nil,"Token de conta V2 invalido" end
    headers["Authorization"]="Bearer "..token
  end
  local chunks={}
  local oldTimeout=http.TIMEOUT
  http.TIMEOUT=5
  local ok,success,status=pcall(http.request,{
    url=url.."/api/account/"..route,method=method,
    headers=headers,source=ltn12.source.string(body),
    sink=ltn12.sink.table(chunks)
  })
  http.TIMEOUT=oldTimeout
  if not ok then return nil,"API de conta V2 indisponivel: "..tostring(success) end
  if not success then return nil,"API de conta V2 falhou: "..tostring(status) end
  local raw=table.concat(chunks)
  if #raw>16384 then return nil,"Resposta de conta V2 muito grande" end
  local decoded,why=Json.decode(raw)
  if type(decoded)~="table" then
    return nil,"Resposta da API V2 invalida: "..tostring(why)
  end
  if tonumber(status)~=200 and tonumber(status)~=201 then
    return nil,tostring(decoded.error or "requisicao_recusada")
  end
  return decoded
end
function M.register(name,password,options)
  if not M.validUsername(name) then
    return nil,"Usuario: de 3 a 20 letras, numeros ou underscore"
  end
  if not M.validPassword(password) then
    return nil,"Senha deve ter entre 12 e 128 caracteres"
  end
  local value,err=request("register","POST",{username=name,password=password},nil,options)
  if not value then return nil,err end
  if value.username~=name or type(value.id)~="string" then
    return nil,"Cadastro nao foi confirmado pelo servidor"
  end
  return {id=value.id,username=value.username}
end
function M.login(name,password,options)
  if not M.validUsername(name) or not M.validPassword(password) then
    return nil,"Usuario ou senha invalidos"
  end
  local value,err=request("login","POST",{username=name,password=password},nil,options)
  if not value then return nil,err end
  if not M.validToken(value.token) or not M.validToken(value.refreshToken)
    or type(value.username)~="string" or type(value.id)~="string" then
    return nil,"Token ou conta V2 invalida na resposta"
  end
  return {token=value.token,refreshToken=value.refreshToken,
    id=value.id,username=value.username,
    expiresIn=value.expiresIn,refreshExpiresIn=value.refreshExpiresIn}
end
-- Rotate refresh tokens once, discarding the previous pair. The API enforces
-- one-use renewal atomically in Redis; never log or persist either token.
function M.refresh(refreshToken,options)
  if not M.validToken(refreshToken) then
    return nil,"Token de renovacao V2 invalido"
  end
  local value,err=request("refresh","POST",
    {refreshToken=refreshToken},nil,options)
  if not value then return nil,err end
  if not M.validToken(value.token) or not M.validToken(value.refreshToken)
    or type(value.username)~="string" or type(value.id)~="string" then
    return nil,"Resposta de renovacao V2 invalida"
  end
  return {token=value.token,refreshToken=value.refreshToken,
    id=value.id,username=value.username,
    expiresIn=value.expiresIn,refreshExpiresIn=value.refreshExpiresIn}
end
function M.me(token,options)
  local result,err=request("me","GET",nil,token,options)
  if not result then return nil,err end
  if type(result.username)~="string" then return nil,"Resposta de perfil invalida" end
  return result
end
function M.logout(token,options,refreshToken)
  -- An expired access token can still be revoked via the refresh token.
  -- Do not bypass errors other than an explicit expired/invalid access token.
  if token~=nil and not M.validToken(token) then
    return nil,"Token de conta V2 invalido"
  end
  if refreshToken~=nil and not M.validToken(refreshToken) then
    return nil,"Token de renovacao V2 invalido"
  end
  if not token and not refreshToken then
    return nil,"Nenhuma sessao para encerrar"
  end
  local result,err
  if token then result,err=request("logout","POST",{},token,options) end
  if (not token or (not result and err=="invalid_player_token"))
    and refreshToken then
    result,err=request("logout","POST",{refreshToken=refreshToken},nil,options)
  end
  if not result then return nil,err end
  return result.ok==true or nil,result.ok==true and nil or "Logout nao confirmado"
end
return M
