-- Read the original pinned server's protocol-build.json (READ-ONLY).
-- The Lua client does not patch or write any file in the upstream server.
local M={}
local fields={"salt","rounds","tapA","tapB","rotA","rotB","mult"}
function M.parse(json)
  if type(json)~="string" or #json>32768 then return nil,"invalid build JSON" end
  local buildId=json:match('"buildId"%s*:%s*"([%w]+)"')
  if not buildId then return nil,"buildId absent" end
  local values={buildId=buildId}
  for _,name in ipairs(fields) do
    local match=json:match('"'..name..'"%s*:%s*(%d+)')
    if not match then return nil,"missing "..name end
    values[name]=tonumber(match)
  end
  local array=json:match('"constants"%s*:%s*%[([^%]]+)%]')
  if not array then return nil,"missing constants" end
  values.constants={}
  for number in array:gmatch("%d+") do
    values.constants[#values.constants+1]=tonumber(number)
  end
  if #values.constants~=8 then return nil,"invalid constants" end
  for _,v in ipairs(values.constants) do
    if v<0 or v>4294967295 then return nil,"invalid constant range" end
  end
  if values.salt>4294967295 or values.mult>4294967295
    or values.rounds<1 or values.rounds>16
    or values.tapA<1 or values.tapA>7
    or values.tapB<1 or values.tapB>7
    or values.rotA<1 or values.rotA>31
    or values.rotB<1 or values.rotB>31 then
    return nil,"invalid build parameters"
  end
  return values
end
function M.load()
  -- The .bat supplies an absolute read-only path for the actual running Node
  -- server. Prefer it over any stale source-directory copy.
  local content=nil
  local absolute=os.getenv("MOOQUEST_BUILD_FILE")
  if absolute and #absolute>0 then
    local file=io.open(absolute,"rb")
    if file then
      content=file:read(32769)
      file:close()
    else
      return nil,"MOOQUEST_BUILD_FILE nao encontrado: "..absolute
    end
  end
  if not content and love and love.filesystem then
    local root="node-runtime/server/data/protocol-build.json"
    if love.filesystem.getInfo(root) then
      content=love.filesystem.read(root)
    end
  end
  if not content then
    return nil,"protocol-build.json do servidor Node nao encontrado; execute INICIAR-WINDOWS.bat"
  end
  return M.parse(content)
end
return M
