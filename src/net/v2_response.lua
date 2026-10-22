-- Explain failed HTTPS/proxy responses without echoing credentials, HTML,
-- access tokens or a Web Application Firewall challenge into the game UI.
local Json=require("src.net.json")
local M={}
local function header(headers,name)
  if type(headers)~="table" then return nil end
  for key,value in pairs(headers) do
    if type(key)=="string" and key:lower()==name then
      return type(value)=="string" and value:lower() or nil
    end
  end
end
local function numberCode(code)
  local n=tonumber(code)
  if n and n>=100 and n<=599 and n%1==0 then return n end
  return nil
end
local function describe(status,reason)
  local http=numberCode(status)
  if not http then return "Resposta HTTP invalida da API V2" end
  return "API V2 HTTP "..http..": "..reason
end
function M.decode(chunks,status,headers,limit,statusLine)
  local http=numberCode(status)
  if not http then return nil,"API V2 nao retornou status HTTP valido" end
  -- The local HTTPS relay uses this fixed status phrase for its own 403.
  -- Do not confuse that with Cloudflare/Nginx's remote 403 response.
  if http==403 and type(statusLine)=="string"
      and statusLine:find("403 Local relay request denied",1,true) then
    return nil,"Ponte HTTPS local recusou a requisicao (HTTP 403). Atualize o cliente."
  end
  local raw=type(chunks)=="table" and table.concat(chunks) or ""
  if #raw>(limit or 16384) then
    return nil,describe(http,"resposta excede limite")
  end
  local contentType=header(headers,"content-type")
  local encoding=header(headers,"content-encoding")
  if encoding and encoding~="identity" then
    return nil,describe(http,"resposta comprimida nao suportada ("..
      encoding:gsub("[^%a%-]",""):sub(1,25)..")")
  end
  if contentType and not contentType:match("^application/json[%s;]") and
     contentType~="application/json" then
    local label=contentType:match("^text/html") and "pagina HTML" or
      contentType:match("^text/plain") and "texto simples" or
      "conteudo inesperado"
    return nil,describe(http,label..
      " em vez de JSON; verifique o proxy HTTPS/Nginx da VPS")
  end
  local first=raw:match("^%s*(.)")
  if first~="{" then
    local reason=first=="<" and "pagina HTML" or
      first==nil and "resposta vazia" or "conteudo nao JSON"
    return nil,describe(http,reason..
      " em vez de JSON; verifique o proxy HTTPS/Nginx da VPS")
  end
  local decoded,why=Json.decode(raw)
  if type(decoded)~="table" then
    -- No raw response bytes or parser traceback are shown; errors can
    -- contain sensitive server-generated values or HTML.
    return nil,describe(http,"JSON malformado; verifique a API V2")
  end
  return decoded,nil,http
end
return M
